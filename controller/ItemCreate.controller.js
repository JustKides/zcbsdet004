/*global location */
sap.ui.define([
	"huawei/cbs/det004/controller/BaseController",
	"huawei/cbs/det004/model/formatter",
	"huawei/cbs/det004/model/validator",
	"sap/ui/model/json/JSONModel",
	'sap/ui/core/format/NumberFormat',
	"sap/ui/Device",
	"sap/m/Button",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/model/Filter",
	"sap/m/MessagePopover",
	"sap/m/MessagePopoverItem"
], function(
	BaseController,
	formatter,
	validator,
	JSONModel,
	NumberFormat,
	Device,
	Button,
	MessageBox,
	MessageToast,
	Filter,
	MessagePopover,
	MessagePopoverItem
) {
	"use strict";

	var that;

	var itemController = BaseController.extend("huawei.cbs.det004.controller.ItemCreate", {
		formatter: formatter,
		validator: validator,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function() {
			that = this;

			// set message model
			that.oMessageManager = sap.ui.getCore().getMessageManager();
			that.setModel(that.oMessageManager.getMessageModel(), "message");

			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var oViewModel = new JSONModel({
				busy: false,
				delay: 0,
				status: "draft",
				editable: true,
				partnerSelected: false,
				authoritySelected: false
			});
			oViewModel.setDefaultBindingMode(sap.ui.model.BindingMode.TwoWay);
			that.setModel(oViewModel, "itemView");

			that._fNFormatter = NumberFormat.getFloatInstance();

			that._partnersList = that.byId("partnersList");
			that._taxCostsList = that.byId("taxCostsList");
			that._feeCostsList = that.byId("feeCostsList");
			that._authoritiesList = that.byId("authoritiesList");

			that._fragmentPrefix = "huawei.cbs.det004.fragment.";

			that._partnerDialog = sap.ui.xmlfragment(that.getView().getId(), that._fragmentPrefix + "PartnerDialog", this);
			that.getView().addDependent(that._partnerDialog);

			that._costDialog = sap.ui.xmlfragment(that.getView().getId(), that._fragmentPrefix + "ItemCostDialog", this);
			that.getView().addDependent(that._costDialog);

			that._authorityDialog = sap.ui.xmlfragment(that.getView().getId(), that._fragmentPrefix + "AuthorityDialog", this);
			that.getView().addDependent(that._authorityDialog);

			that.oLineItemTable = that.byId("authoritiesList");

			that.getRouter().getRoute("itemCreate").attachPatternMatched(that._onItemMatched, this);
			that.getOwnerComponent().getModel().metadataLoaded().then(that._onMetadataLoaded.bind(this));
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		onItemCodeChange: function(oEvent) {
			var oViewModel = that.getModel("itemView");
			oViewModel.setProperty("/busy", true);
			var oContext = that.getView().getBindingContext();

			var sItemCode = oEvent.getParameters("newValue").newValue;
			var sNumberScheme = that.getModel().getProperty(oContext.sPath + "/NumberScheme");
			var sCountry = that.getModel().getProperty(oContext.sPath + "/Country");

			var promise1 = new Promise(function(resolve, reject) {
				that.getModel().callFunction("/GetGoodsName", {
					method: "POST",
					groupId: "GetGoodsName_" + new Date().getTime(),
					urlParameters: {
						ItemCode: sItemCode,
						Country: sCountry
					},
					success: function(oData) {
						that.getModel().setProperty(oContext.sPath + "/GoodsName", oData.GoodsName);
						that.getModel().setProperty(oContext.sPath + "/GoodsNameLocal", oData.GoodsNameLocal);

						resolve();
					},
					error: function() {
						oViewModel.setProperty("/busy", false);
						reject();
					}
				});
			});

			var promise2 = new Promise(function(resolve, reject) {
				that.getModel().callFunction("/GetHSCode", {
					method: "POST",
					groupId: "GetHSCode_" + new Date().getTime(),
					urlParameters: {
						ItemCode: sItemCode,
						NumberScheme: sNumberScheme
					},
					success: function(oData) {
						that.getModel().setProperty(oContext.sPath + "/HsCodeID", oData.HSCodeID);
						that.getModel().setProperty(oContext.sPath + "/HsCode", oData.HSCode);
						that.getModel().setProperty(oContext.sPath + "/BOEUnit", oData.BoeUnit);
						that.getModel().setProperty(oContext.sPath + "/BOEUnitExternal", oData.BoeUnitExternal);

						that._onBOEUnitChange();

						that.onItemQuantityChange();
						resolve();
					},
					error: function() {
						oViewModel.setProperty("/busy", false);
						reject();
					}
				});
			});

			Promise.all([promise1, promise2]).then(function() {
				oViewModel.setProperty("/busy", false);
			});
		},

		onItemQuantityChange: function(oEvent) {
			var oViewModel = that.getModel("itemView");
			oViewModel.setProperty("/busy", true);
			var oContext = that.getView().getBindingContext();

			var sItemCodeId = that.sanitizeGuid(that.getModel().getProperty(oContext.sPath + "/ProductID"));
			var sHsCodeId = that.sanitizeGuid(that.getModel().getProperty(oContext.sPath + "/HsCodeID"));
			var sNumberScheme = that.getModel().getProperty(oContext.sPath + "/NumberScheme");
			var sInputQty = that.getModel().getProperty(oContext.sPath + "/Qty");
			var sInputUnit = that.getModel().getProperty(oContext.sPath + "/UoM");

			var deferred = jQuery.Deferred();
			if (oEvent) {
				var sFieldName = oEvent.getSource()._oValueBind.path;
				if (sFieldName === "HsCode") {
					var sHsCode = oEvent.getParameters("value").newValue;
					that.getModel().read("/Zcbs_C_Hscode", {
						urlParameters: {
							$filter: "HSCode eq '" + sHsCode + "' and NumberScheme eq '" + sNumberScheme + "'"
						},
						success: function(oData) {
							if (oData && oData.results && oData.results.length > 0) {
								var oHsCode = oData.results[0];
								sHsCodeId = that.sanitizeGuid(oHsCode.HSCodeID);
							} else {
								sHsCodeId = null;
							}
							deferred.resolve();
						}
					});
				} else {
					deferred.resolve();
				}
			} else {
				deferred.resolve();
			}
			var promise = deferred.promise();

			jQuery.when(promise).done(function() {
				if (!(sItemCodeId && sItemCodeId !== "" && sHsCodeId && sHsCodeId !== ""
						&& sInputQty && sInputQty !== "" && sInputUnit && sInputUnit !== "")) {
					that._onWeightUnitChange();
					oViewModel.setProperty("/busy", false);
					return;
				}

				that.getModel().callFunction("/ConvertUnit", {
					method: "POST",
					groupId: "ConvertUnit_" + new Date().getTime(),
					urlParameters: {
						ItemCodeID: sItemCodeId,
						HSCodeID: sHsCodeId,
						InputQty: Number(sInputQty),
						InputUnit: sInputUnit
					},
					success: function(oData) {
						if (oData.OutputQty) {
							that.getModel().setProperty(oContext.sPath + "/BOEQty", Number(oData.OutputQty).toString());
							that.getModel().setProperty(oContext.sPath + "/BOEUnit", oData.OutputUnit);
							that.getModel().setProperty(oContext.sPath + "/BOEUnitExternal", oData.OutputUnitExternal);
							that.getModel().setProperty(oContext.sPath + "/BOERate", Number(oData.BoeRate).toString());
						} else {
							that.getModel().setProperty(oContext.sPath + "/BOEQty", "");
							that.getModel().setProperty(oContext.sPath + "/BOEUnit", "");
							that.getModel().setProperty(oContext.sPath + "/BOEUnitExternal", "");
							that.getModel().setProperty(oContext.sPath + "/BOERate", "");
						}

						that._onBOEUnitChange();

						that._onWeightUnitChange();

						oViewModel.setProperty("/busy", false);
					},
					error: function() {
						oViewModel.setProperty("/busy", false);
					}
				});
			});
		},

		_onBOEUnitChange: function() {
			var oViewModel = that.getModel("itemView");
			var sCountry = oViewModel.getProperty("/detCountry");
			var sBusinessType = oViewModel.getProperty("/detBusinessType");

			var oContext = that.getView().getBindingContext();
			var sQty = that.getModel().getProperty(oContext.sPath + "/Qty");
			var sBOEUnit = that.getModel().getProperty(oContext.sPath + "/BOEUnit");

			if (sQty && sCountry === "HK" && sBusinessType === "20" && sBOEUnit === "M") {
				that.getModel().setProperty(oContext.sPath + "/BOEQty", parseFloat(sQty));
			}
		},

		onItemBOEQtyChange: function() {
			var oViewModel = that.getModel("itemView");
			oViewModel.setProperty("/busy", true);

			that._onBOEUnitChange();

			var oContext = that.getView().getBindingContext();
			var sQty = that.getModel().getProperty(oContext.sPath + "/Qty");
			var sUoM = that.getModel().getProperty(oContext.sPath + "/UoM");
			var sBOEQty = that.getModel().getProperty(oContext.sPath + "/BOEQty");
			var sBOEUnit = that.getModel().getProperty(oContext.sPath + "/BOEUnit");
			var fRate;
			if (sUoM === sBOEUnit) {
				fRate = 1;
			} else {
				if (sQty && Number(sQty) !== 0) {
					fRate = sBOEQty / sQty;
				} else {
					fRate = 0;
				}
			}
			var sRate = Math.round(fRate * 10000) / 10000;
			that.getModel().setProperty(oContext.sPath + "/BOERate", Number(sRate).toString());
			oViewModel.setProperty("/busy", false);
		},

		onNetWeightInnerControlsCreated: function(oEvent) {
			var aInnerInput = oEvent.getSource().getInnerControls();
			if (aInnerInput && aInnerInput.length >= 2) {
				var oInnerInput = aInnerInput[0];
				oInnerInput.attachChange(function() {
					that._onWeightUnitChange();
				});
				var oUnitInput = aInnerInput[1];
				oUnitInput.attachChange(function() {
					that._onWeightUnitChange();
				});
			}
		},

		_onWeightUnitChange: function() {
			var oContext = that.getView().getBindingContext();
			var sBOEUnit = that.getModel().getProperty(oContext.sPath + "/BOEUnit");
			var sWeightUnit = that.getModel().getProperty(oContext.sPath + "/WeightUnit");
			if (sBOEUnit === "KG" && sWeightUnit === "KG") {
				that.getModel().setProperty(oContext.sPath + "/BOEQty", that.getModel().getProperty(oContext.sPath + "/NetWeight"));
			}
			if (sBOEUnit === "KG" && sWeightUnit === "G") {
				that.getModel().setProperty(oContext.sPath + "/BOEQty", (Number(that.getModel().getProperty(oContext.sPath + "/NetWeight")) / 1000).toString());
			}
			that.onItemBOEQtyChange();
		},

		onAmountInnerControlsCreated: function(oEvent) {
			var aInnerInput = oEvent.getSource().getInnerControls();
			if (aInnerInput && aInnerInput.length >= 1) {
				var oInnerInput = aInnerInput[0];
				oInnerInput.attachChange(that.onAmountChange);
			}
		},

		onQtyInnerControlsCreated: function(oEvent) {
			var aInnerInput = oEvent.getSource().getInnerControls();
			if (aInnerInput && aInnerInput.length >= 2) {
				var oInnerInput = aInnerInput[0];
				oInnerInput.attachChange(that.onAmountChange);
				var oUnitInput = aInnerInput[1];
				oUnitInput.setValueHelpOnly(true);
			}
		},

		onAmountChange: function(oEvent) {
			var oContext = that.getView().getBindingContext();

			var sAmount = oEvent.getParameters("value").newValue;
			var sQty = that.getModel().getProperty(oContext.sPath + "/Qty");
			if (sQty) {
				sQty = Number(sQty).toString();
			}

			var sPath = oEvent.getSource().mBindingInfos.value.parts[0].path;
			if (sPath === "Qty") {
				sAmount = that.getModel().getProperty(oContext.sPath + "/Amount").toString();
				sQty = oEvent.getParameters("value").newValue;
			}

			if (sAmount && sQty && that._fNFormatter.parse(sQty) !== 0) {
				var fUnitPrice = that._fNFormatter.parse(sAmount) / that._fNFormatter.parse(sQty);
				var sUnitPrice = Math.round(fUnitPrice * 100000) / 100000;
				that.getModel().setProperty(oContext.sPath + "/UnitPrice", Number(sUnitPrice));
			} else {
				that.getModel().setProperty(oContext.sPath + "/UnitPrice", null);
			}
		},

		onSave: function() {
			var oViewModel = that.getModel("itemView");

			var aSmartFields = [
				{ control: that.byId("amountInput") },
				{ control: that.byId("qtyInput") },
				{ control: that.byId("boeQtyInput") },
				{ control: that.byId("netWeightInput") },
				{ control: that.byId("packageQtyInput") }
			];
			var bSfError = false;
			jQuery.each(aSmartFields, function(i, oObject) {
				bSfError = validator.validateSmartField(oObject) || bSfError;
			});
			if (bSfError) {
				MessageBox.error(that.getResourceBundle().getText("confirmBeforeSave"), {
					styleClass: that.getOwnerComponent().getContentDensityClass()
				});
			} else {
				MessageBox.confirm(that.getResourceBundle().getText("confirmToSave"), {
					styleClass: that.getOwnerComponent().getContentDensityClass(),
					actions: [MessageBox.Action.YES, MessageBox.Action.NO],
					onClose: function(oAction) {
						if (oAction === MessageBox.Action.YES) {
							oViewModel.setProperty("/busy", true);

							var sCountry = oViewModel.getProperty("/detCountry");
							var sBusinessType = oViewModel.getProperty("/detBusinessType");
							var sImportOrExport = oViewModel.getProperty("/detImportOrExport");

							sap.ui.getCore().getMessageManager().removeAllMessages();
							var aInputs = [
								{ control: that.byId("itemCodeInput"), label: that.getResourceBundle().getText("itemBasicLabelItemCode") },
								{ control: that.byId("qtyInput"), label: that.getResourceBundle().getText("itemBasicLabelQuantity") }
							];
							if (sCountry === "HK" && sBusinessType === "20" && sImportOrExport === "2") {
								aInputs.push({ control: that.byId("packageQtyInput"), label: that.getResourceBundle().getText("itemPackagingLabelPackageQty") });
							}

							var aSelects = [];

							if (sCountry === "HK" && sBusinessType === "20" && sImportOrExport === "2") {
								aSelects.push({ control: that.byId("coOSelect"), label: that.getResourceBundle().getText("itemBasicLabelCoO") });
								aSelects.push({ control: that.byId("packageTypeSelect"), label: that.getResourceBundle().getText("itemPackagingLabelPackageType") });
							}

							var bValidationError = false;

							// check that inputs are not empty
							// this does not happen during data binding as this is only triggered by changes
							jQuery.each(aInputs, function (i, oObject) {
								bValidationError = validator.validateInput(oObject) || bValidationError;
							});
							jQuery.each(aSelects, function(i, oObject) {
								bValidationError = validator.validateSelect(oObject) || bValidationError;
							});

							if (!bValidationError) {
								that._saveItem("CREATE");
							} else {
								oViewModel.setProperty("/busy", false);
							}
						} else {
							oViewModel.setProperty("/busy", false);
						}
					}
				});
			}
		},

		onCancel: function() {
			that.onCloseItemPress();
		},

		// Partner Section Start
		onPartnerSelectionChange: function(oEvent) {
			var oViewModel = that.getModel("itemView");
			var selectedItems = oEvent.getSource().getSelectedIndices();
			if (selectedItems.length <= 0) {
				oViewModel.setProperty("/partnerSelected", false);
			} else {
				oViewModel.setProperty("/partnerSelected", true);
			}
		},

		_origPartners: {},

		onPartnerAdd: function() {
			for (var i in that._partnersList.getRows()) {
				var p = that._partnersList.getRows()[i].getBindingContext().getObject();
				var guid = p.ParID;
				var type = p.ParObjectType;
				var number = p.ParNumber;
				var name = p.ParName;
				var address = p.Address;
				that._origPartners[guid] = {ParObjectType: type, ParNumber: number, ParName: name, Address: address};
			}

			var oViewModel = that.getModel("itemView");
			oViewModel.setProperty("/new", true);
			var oContext = that.getModel().createEntry("/ZCBS_C_DETBPI", {
				properties: {
					ParID: that.guid(),
					ParGUID: "",
					ParObject: "O2",
					ItemID: that._sItemId,
					ParObjectType: "",
					ParObjectTypeDesc: "",
					ParNumber: "",
					Country: "",
					AddrNumber: "",
					ParName: "",
					Address: ""
				}
			});

			that._partnerDialog.setBindingContext(oContext);
			that._partnerDialog.bindElement(oContext.sPath);
			that._partnerDialog.open();
		},

		onPartnerEdit: function(oEvent) {
			for (var i in that._partnersList.getRows()) {
				var p = that._partnersList.getRows()[i].getBindingContext().getObject();
				var guid = p.ParID;
				var type = p.ParObjectType;
				var number = p.ParNumber;
				var name = p.ParName;
				var address = p.Address;
				that._origPartners[guid] = {ParObjectType: type, ParNumber: number, ParName: name, Address: address};
			}

			var oViewModel = that.getModel("itemView");
			oViewModel.setProperty("/new", false);
			var oContext = oEvent.getSource().getParent().getBindingContext();

			that._partnerDialog.setBindingContext(oContext);
			that._partnerDialog.bindElement(oContext.sPath);
			that._partnerDialog.open();
		},

		onPartnerDelete: function() {
			MessageBox.warning(that.getResourceBundle().getText("confirmToDelete"), {
				styleClass: that.getOwnerComponent().getContentDensityClass(),
				actions: [MessageBox.Action.YES, MessageBox.Action.NO],
				onClose: function(oAction) {
					if (oAction === MessageBox.Action.YES) {
						var oViewContext = that.getView().getBindingContext();
						var selectedItems = that._partnersList.getSelectedIndices().reverse();
						var oModel = that._partnersList.getModel();
						var oData = that.getModel().getProperty("to_BPI", oViewContext);
						for (var i in selectedItems) {
							var oContext = that._partnersList.getContextByIndex(selectedItems[i]);
							var sDeleteItemPath = oContext.getPath().slice(1);
							var bp = oContext.getObject();

							var index = oData.indexOf(sDeleteItemPath);
							if (index !== -1) {
								oData.splice(index, 1);
							}

							var array = [];
							for (var j in that._itemBpArray) {
								var itemBp = that._itemBpArray[j];
								if (itemBp.ParID !== bp.ParID) {
									array.push(itemBp);
								}
							}
							that._itemBpArray = array;
						}
						oModel.setProperty("to_BPI", oData, oViewContext);
						that._partnersList.setSelectedIndex(-1);
						MessageToast.show(that.getResourceBundle().getText("successDELETE"));
					}
				}
			});
		},

		onPartnerFunctionChange: function(oEvent) {
			var oItem = oEvent.getParameters("selectedItem");
			var sParObjectTypeDesc = oItem.selectedItem.mProperties.text;
			var sParObjectType = oItem.selectedItem.mProperties.additionalText;

			var oContext = that._partnerDialog.getBindingContext();

			that.getModel().setProperty(oContext.sPath + "/ParObjectType", sParObjectType);
			that.getModel().setProperty(oContext.sPath + "/ParObjectTypeDesc", sParObjectTypeDesc);

			if (sParObjectType === "CUSFRW") { // LSP
				that._partnerDialog.setBusy(true);
				that.getModel().read("/Zcbs_C_BPSH", {
					filters: [
						new Filter("ParNumber", sap.ui.model.FilterOperator.EQ, "LSP_DUMMY1")
					],
					success: function(oData) {
						if (oData && oData.results && oData.results.length > 0) {
							var oLSP = oData.results[0];
							var sParNumber = oLSP.ParNumber;
							var sParName = oLSP.ParName;
							var sAddress = oLSP.Address;
							var sCountry = oLSP.Country;
							var sParGUID = oLSP.Partner_Guid;

							that.getModel().setProperty(oContext.sPath + "/ParNumber", sParNumber);
							that.getModel().setProperty(oContext.sPath + "/ParName", sParName);
							that.getModel().setProperty(oContext.sPath + "/Address", sAddress);
							that.getModel().setProperty(oContext.sPath + "/Country", sCountry);
							that.getModel().setProperty(oContext.sPath + "/ParGUID", sParGUID);
						}
						that._partnerDialog.setBusy(false);
					},
					error: function() {
						that._partnerDialog.setBusy(false);
					}
				});
			} else if (sParObjectType === "CUSEMP") { // Consignee
				that._partnerDialog.setBusy(true);
				that.getModel().read("/Zcbs_C_BPSH", {
					filters: [
						new Filter("ParNumber", sap.ui.model.FilterOperator.EQ, "CON_DUMMY1")
					],
					success: function(oData) {
						if (oData && oData.results && oData.results.length > 0) {
							var oCON = oData.results[0];
							var sParNumber = oCON.ParNumber;
							var sParName = oCON.ParName;
							var sAddress = oCON.Address;
							var sCountry = oCON.Country;
							var sParGUID = oCON.Partner_Guid;

							that.getModel().setProperty(oContext.sPath + "/ParNumber", sParNumber);
							that.getModel().setProperty(oContext.sPath + "/ParName", sParName);
							that.getModel().setProperty(oContext.sPath + "/Address", sAddress);
							that.getModel().setProperty(oContext.sPath + "/Country", sCountry);
							that.getModel().setProperty(oContext.sPath + "/ParGUID", sParGUID);
						}
						that._partnerDialog.setBusy(false);
					},
					error: function() {
						that._partnerDialog.setBusy(false);
					}
				});
			} else if (sParObjectType === "CUSVER") { // Shipper
				that._partnerDialog.setBusy(true);
				that.getModel().read("/Zcbs_C_BPSH", {
					filters: [
						new Filter("ParNumber", sap.ui.model.FilterOperator.EQ, "SIP_DUMMY1")
					],
					success: function(oData) {
						if (oData && oData.results && oData.results.length > 0) {
							var oSIP = oData.results[0];
							var sParNumber = oSIP.ParNumber;
							var sParName = oSIP.ParName;
							var sAddress = oSIP.Address;
							var sCountry = oSIP.Country;
							var sParGUID = oSIP.Partner_Guid;

							that.getModel().setProperty(oContext.sPath + "/ParNumber", sParNumber);
							that.getModel().setProperty(oContext.sPath + "/ParName", sParName);
							that.getModel().setProperty(oContext.sPath + "/Address", sAddress);
							that.getModel().setProperty(oContext.sPath + "/Country", sCountry);
							that.getModel().setProperty(oContext.sPath + "/ParGUID", sParGUID);
						}
						that._partnerDialog.setBusy(false);
					},
					error: function() {
						that._partnerDialog.setBusy(false);
					}
				});
			}

			that._partnerDialog.setBindingContext(oContext);
			that._partnerDialog.bindElement(oContext.sPath);
		},

		_newAddedPartners: [],

		onPartnerSave: function() {
			var oViewContext = that.getView().getBindingContext();
			var oContext = that._partnerDialog.getBindingContext();
			var bp = oContext.getObject();
			var parObjectType = bp.ParObjectType;
			var parName = bp.ParName;
			if (parObjectType && parName) {
				var array = [];
				var found = false;
				for (var i in that._itemBpArray) {
					var itemBp = that._itemBpArray[i];
					if (itemBp.ParGUID === bp.ParGUID) {
						array.push(bp);
						found = true;
					} else {
						array.push(itemBp);
					}
				}
				if (!found) {
					array.push(bp);

					if (!that.getModel().getProperty("to_BPI", oViewContext)) {
						that.getModel().setProperty("to_BPI", [oContext.getPath().slice(1)], oViewContext);
					} else {
						var aNewPathArray = that.getModel().getProperty("to_BPI", oViewContext).concat([oContext.getPath().slice(1)]);
						that.getModel().setProperty("to_BPI", aNewPathArray, oViewContext);
					}
					that._newAddedPartners.push(oContext.getPath().slice(1));
				}

				that._itemBpArray = array;

				that._partnerDialog.unbindElement();
				that._partnerDialog.close();
			} else {
				MessageToast.show(that.getResourceBundle().getText("errorSaveNewPartner"));
			}
		},

		onPartnerCancel: function() {
			for (var i in that._partnersList.getRows()) {
				var oContext = that._partnersList.getRows()[i].getBindingContext();
				var guid = that.getModel().getProperty(oContext.sPath + "/ParID");
				that.getModel().setProperty(oContext.sPath + "/ParObjectType", that._origPartners[guid].ParObjectType);
				that.getModel().setProperty(oContext.sPath + "/ParNumber", that._origPartners[guid].ParNumber);
				that.getModel().setProperty(oContext.sPath + "/ParName", that._origPartners[guid].ParName);
				that.getModel().setProperty(oContext.sPath + "/Address", that._origPartners[guid].Address);
			}

			that._partnerDialog.unbindElement();
			that._partnerDialog.close();
		},

		onPartnerClose: function() {
			that._partnerDialog.unbindElement();
			that._partnerDialog.close();
		},
		// Partner Section End

		// Cost Section Start
		onBeforeRebindTaxTable: function(oEvent) {
			var mBindingParams = oEvent.getParameter("bindingParams");
			mBindingParams.filters = new sap.ui.model.Filter("CostType", sap.ui.model.FilterOperator.EQ, "T");
		},

		onBeforeRebindFeeTable: function(oEvent) {
			var mBindingParams = oEvent.getParameter("bindingParams");
			mBindingParams.filters = new sap.ui.model.Filter("CostType", sap.ui.model.FilterOperator.EQ, "F");
		},
		// Cost Section End

		// Authority Section Start
		onAuthoritySelectionChange: function(oEvent) {
			var oViewModel = that.getModel("itemView");
			var selectedItems = oEvent.getSource().getSelectedIndices();
			if (selectedItems.length <= 0) {
				oViewModel.setProperty("/authoritySelected", false);
			} else {
				oViewModel.setProperty("/authoritySelected", true);
			}
		},

		_origAuthorities: {},

		onAuthorityAdd: function() {
			for (var i in that._authoritiesList.getRows()) {
				var a = that._authoritiesList.getRows()[i].getBindingContext().getObject();
				var guid = a.Guid_Auth;
				var specification = a.Specification;
				var value = a.Value;
				that._origAuthorities[guid] = {Specification: specification, Value: value};
			}

			var oContext = that.getModel().createEntry("/ZCBS_C_DETAUTHI", {
				properties: {
					Guid_Auth: that.guid(),
					Pobjt: "O2",
					ItemID: that._sItemId,
					Guid_Ctsnum: that._sGuid_Ctsnum,
					Stcts: "",
					Specification: "",
					Value: ""
				}
			});

			that._authorityDialog.setBindingContext(oContext);
			that._authorityDialog.bindElement(oContext.sPath);
			that._authorityDialog.open();
		},

		onAuthorityEdit: function(oEvent) {
			for (var i in that._authoritiesList.getRows()) {
				var a = that._authoritiesList.getRows()[i].getBindingContext().getObject();
				var guid = a.Guid_Auth;
				var specification = a.Specification;
				var value = a.Value;
				that._origAuthorities[guid] = {Specification: specification, Value: value};
			}

			var oViewModel = that.getModel("itemView");
			oViewModel.setProperty("/new", false);
			var oContext = oEvent.getSource().getBindingContext();

			that._authorityDialog.setBindingContext(oContext);
			that._authorityDialog.bindElement(oContext.sPath);
			that._authorityDialog.open();
		},

		onAuthorityDelete: function() {
			MessageBox.warning(that.getResourceBundle().getText("confirmToDelete"), {
				styleClass: that.getOwnerComponent().getContentDensityClass(),
				actions: [MessageBox.Action.YES, MessageBox.Action.NO],
				onClose: function(oAction) {
					if (oAction === MessageBox.Action.YES) {
						var oViewContext = that.getView().getBindingContext();
						var selectedItems = that._authoritiesList.getSelectedIndices().reverse();
						var oModel = that._authoritiesList.getModel();
						var oData = that.getModel().getProperty("to_DETAUTHI", oViewContext);
						for (var i in selectedItems) {
							var oContext = that._authoritiesList.getContextByIndex(selectedItems[i]);
							var sDeleteItemPath = oContext.getPath().slice(1);
							var authority = oContext.getObject();

							var index = oData.indexOf(sDeleteItemPath);
							if (index !== -1) {
								oData.splice(index, 1);
							}

							var array = [];
							for (var j in that._itemAuthArray) {
								var itemAuthority = that._itemAuthArray[j];
								if (itemAuthority.Guid_Auth !== authority.Guid_Auth) {
									array.push(itemAuthority);
								}
							}
							that._itemAuthArray = array;
						}
						oModel.setProperty("to_DETAUTHI", oData, oViewContext);
						that._authoritiesList.setSelectedIndex(-1);
						MessageToast.show(that.getResourceBundle().getText("successDELETE"));
					}
				}
			});
		},

		_newAddedAuths: [],

		onAuthoritySave: function() {
			var oViewContext = that.getView().getBindingContext();
			var oContext = that._authorityDialog.getBindingContext();
			var authority = oContext.getObject();
			var specification = authority.Specification;
			var value = authority.Value;
			if (specification && value) {
				var array = [];
				var found = false;
				for (var i in that._itemAuthArray) {
					var itemAuthority = that._itemAuthArray[i];
					if (itemAuthority.Guid_Auth === authority.Guid_Auth) {
						array.push(authority);
						found = true;
					} else {
						array.push(itemAuthority);
					}
				}
				if (!found) {
					array.push(authority);

					if (!that.getModel().getProperty("to_DETAUTHI", oViewContext)) {
						that.getModel().setProperty("to_DETAUTHI", [oContext.getPath().slice(1)], oViewContext);
					} else {
						var aNewPathArray = that.getModel().getProperty("to_DETAUTHI", oViewContext).concat([oContext.getPath().slice(1)]);
						that.getModel().setProperty("to_DETAUTHI", aNewPathArray, oViewContext);
					}
					that._newAddedPartners.push(oContext.getPath().slice(1));
				}

				that._itemAuthArray = array;

				that._authorityDialog.unbindElement();
				that._authorityDialog.close();
			} else {
				MessageToast.show(that.getResourceBundle().getText("errorSaveNewAuthority"));
			}
		},

		onAuthorityCancel: function() {
			for (var i in that._authoritiesList.getRows()) {
				var oContext = that._authoritiesList.getRows()[i].getBindingContext();
				var guid = that.getModel().getProperty(oContext.sPath + "/Guid_Auth");
				that.getModel().setProperty(oContext.sPath + "/Specification", that._origAuthorities[guid].Specification);
				that.getModel().setProperty(oContext.sPath + "/Value", that._origAuthorities[guid].Value);
			}

			that._authorityDialog.unbindElement();
			that._authorityDialog.close();
		},

		onAuthorityClose: function() {
			that._authorityDialog.unbindElement();
			that._authorityDialog.close();
		},
		// Authority Section End

		onMessagesButtonPress: function(oEvent) {
			var oMessagesButton = oEvent.getSource();

			if (!that._messagePopover) {
				that._messagePopover = new MessagePopover({
					items: {
						path: "message>/",
						template: new MessagePopoverItem({
							description: "{message>description}",
							type: "{message>type}",
							title: "{message>message}"
						})
					}
				});
				oMessagesButton.addDependent(that._messagePopover);
			}
			that._messagePopover.toggle(oMessagesButton);
		},

		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		/**
		 * Binds the view to the object path and expands the aggregated line items.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'item'
		 * @private
		 */
		_onItemMatched: function(oEvent) {
			var sItemID = that.guid();
			var oViewModel = that.getModel("itemView");
			var oArguments = oEvent.getParameter("arguments");
			that._sBusinessType = oArguments.BUSTYPE;
			that._sImpExpIndicator = oArguments.INDEI;
			that._sDeclarationId = oArguments.detailId;

			that.getModel().metadataLoaded().then(function() {
				that.getModel().setSizeLimit(500); // default is 100
				var oContext = that.getModel().createEntry("/ZCBS_C_DETI", {
					properties: {
						ItemID: sItemID,
						Action: "CREATE",
						Country: "",
						HeaderID: that._sDeclarationId,
						ProductNo: "",
						ShortText: "",
						Qty: null,
						UoM: "",
						QtyFloat: null,
						BOEAmount: null,
						BOECurrency: "",
						Amount: null,
						AmountCurrency: "",
						UnitPrice: null,
						UnitPriceCurrency: "",
						NetWeight: null,
						NetWeightFloat: null,
						GrossWeight: null,
						GrossWeightFloat: null,
						WeightUnit: "",
						Origin: "",
						ProductDesc: "",
						Brand: "",
						ProductName: "",
						GoodsNameLocal: "",
						GoodsName: "",
						DocumentItem: "",
						CreateBy: "",
						CreateTimeStamp: null,
						ChangeBy: "",
						ChangeTimeStamp: null,
						ProductID: null,
						Crcy: "",
						Volume: null,
						QtyReViewed: null,
						QtyReViewedUnit: "",
						HKModel: "",
						ProductCode: "",
						HsCode: "",
						HsCodeID: null,
						Rate: null,
						QuantityFirst: "",
						UnitFirst: "",
						QuantitySecond: "",
						UnitSecond: "",
						NumberScheme: "",
						Taxation: "",
						Revision: "",
						CCCNo: "",
						BatteryNo: "",
						SuperviseCode: "",
						PackageQty: null,
						PackageType: "",
						PackageTypeTxt: "",
						PackingInstruction: "",
						TradeTerms: "",
						DiscountFlag: null,
						Device: "",
						LineConTractNo: "",
						ContractVersion: "",
						LinePLNo: "",
						Remarks: "",
						ItemLevelID: "",
						LegalRegulation: "",
						Guid_Ctsnum: null,
						SecondQty: null,
						SecondUnit: "",
						BOEQty: null,
						BOEUnit: "",
						BOEUnitExternal: "",
						BOERate: null,
						RateSecond: "",
						ManufacturerName: "",
						ManufacturerNameID: "",
						DutyName: "",
						DutyRate: "",
						LicenseItemStatus: "",
						LicenseItemStatusText: "",
						Probability: null
					}
				});

				that._sItemId = sItemID;

				that.getView().setBindingContext(oContext);
				that.getView().bindElement(oContext.sPath);

				that._itemBpArray = [];
				that._itemCostArray = [];
				that._itemAuthArray = [];
				that._itemLicArray = [];

				oViewModel.setProperty("/busy", false);

				that._toggleButtonsAndView(true);

				var sDeclarationPath = that.getModel().createKey("ZCBS_C_DETH", {
					HeaderID: that._sDeclarationId
				});
				that.sDetailPath = sDeclarationPath;
				that.getModel().read("/" + sDeclarationPath, {
					success: function(oData) {
						var sCountry = oData.Country;
						that.sCountry = oData.Country;
						var sBusinessType = oData.BusinessType;
						var sImportOrExport = oData.ImportOrExport;
						var sInvoiceCurrency = oData.InvoiceCurrency;
						var sBOECurrency = oData.BOECurrency;
						var sNumberScheme = oData.NumberScheme;
						if (sCountry != null && sCountry !== "") {
							oViewModel.setProperty("/detCountry", sCountry);
						}
						if (sBusinessType != null && sBusinessType !== "") {
							oViewModel.setProperty("/detBusinessType", sBusinessType);
						}
						if (sImportOrExport != null && sImportOrExport !== "") {
							oViewModel.setProperty("/detImportOrExport", sImportOrExport);
						}
						var sContext = that.getView().getBindingContext();
						that.getModel().setProperty(sContext.sPath + "/AmountCurrency", sInvoiceCurrency);
						that.getModel().setProperty(sContext.sPath + "/UnitPriceCurrency", sInvoiceCurrency);
						that.getModel().setProperty(sContext.sPath + "/BOECurrency", sBOECurrency);
						that.getModel().setProperty(sContext.sPath + "/NumberScheme", sNumberScheme);
						that.getModel().setProperty(sContext.sPath + "/Country", sCountry);
					}
				});
			});
		},

		_onMetadataLoaded: function() {
			// Store original busy indicator delay for the detail view
			var iOriginalViewBusyDelay = that.getView().getBusyIndicatorDelay(),
				oViewModel = that.getModel("itemView"),
				iOriginalLineItemTableBusyDelay = that.oLineItemTable.getBusyIndicatorDelay();

			// Make sure busy indicator is displayed immediately when detail view is displayed for the first time
			oViewModel.setProperty("/delay", 0);
			oViewModel.setProperty("/lineItemTableDelay", 0);

			that.oLineItemTable.attachEventOnce("updateFinished", function() {
				// Restore original busy indicator delay for line item table
				oViewModel.setProperty("/lineItemTableDelay", iOriginalLineItemTableBusyDelay);
			});

			// Binding the view will set it to not busy - so the view is always busy if it is not bound
			oViewModel.setProperty("/busy", true);
			// Restore original busy indicator delay for the detail view
			oViewModel.setProperty("/delay", iOriginalViewBusyDelay);
		},

		_saveItem: function(sAction) {
			var oItem = that.getView().getBindingContext().getObject();
			oItem.Action = sAction;
			if (!oItem.to_BPI) {
				oItem.to_BPI = {};
			}
			if (!oItem.to_COSTI) {
				oItem.to_COSTI = {};
			}
			if (!oItem.to_DETAUTHI) {
				oItem.to_DETAUTHI = {};
			}
			if (!oItem.to_ItemToLicense) {
				oItem.to_ItemToLicense = {};
			}

			var bpArray = [];
			for (var i in that._itemBpArray) {
				var bp = that._itemBpArray[i];
				if ((bp.ParID && bp.ParID.match(/^ffffffff-/)) || (bp.ParNumber && bp.ParNumber === "LSP_DUMMY1")
						|| (bp.ParNumber && bp.ParNumber === "CON_DUMMY1") || (bp.ParNumber && bp.ParNumber === "SIP_DUMMY1")) {
					delete bp.ParID;
					delete bp.ItemID;
					delete bp.Role;
					delete bp.__metadata;
				}
				bpArray.push(bp);
			}
			var authArray = [];
			for (var j in that._itemAuthArray) {
				var auth = that._itemAuthArray[j];
				if (auth.Guid_Auth && auth.Guid_Auth.match(/^ffffffff-/)) {
					delete auth.Guid_Auth;
					delete auth.ItemID;
					delete auth.__metadata;
				}
				authArray.push(auth);
			}

			// FIXME Offset issue for decimal fields
			oItem.Amount = oItem.Amount ? oItem.Amount.toString() : null;
			oItem.UnitPrice = oItem.UnitPrice ? oItem.UnitPrice.toString() : null;
			oItem.Qty = oItem.Qty ? oItem.Qty.toString() : null;
			oItem.BOEQty = oItem.BOEQty ? oItem.BOEQty.toString() : null;
			oItem.GrossWeight = oItem.GrossWeight ? oItem.GrossWeight.toString() : null;
			oItem.NetWeight = oItem.NetWeight ? oItem.NetWeight.toString() : null;

			oItem.to_BPI = { results: bpArray };
			oItem.to_COSTI.results = that._itemCostArray;
			oItem.to_DETAUTHI = { results: authArray };
			oItem.to_ItemToLicense.results = that._itemLicArray;

			delete oItem.to_BPI.__list;
			delete oItem.to_COSTI.__list;
			delete oItem.to_DETAUTHI.__list;
			delete oItem.to_ItemToLicense.__list;

			delete oItem.to_DETLEGAL;
			delete oItem.to_DETH;

			delete oItem.ItemID;
			delete oItem.__metadata;

			console.log(oItem);

			that.getModel().create("/ZCBS_C_DETI", oItem, {
				success: function(oData, response) {
					var oViewModel = that.getModel("itemView");

					// response header
					var hdrMessage = response.headers["sap-message"];
					var bSuccess = true;
					if (hdrMessage) {
						var hdrMessageObject = JSON.parse(hdrMessage);
						if (hdrMessageObject && hdrMessageObject.severity !== "success" && hdrMessageObject.severity !== "info") {
							bSuccess = false;
							MessageBox.error(hdrMessageObject.message, {
								styleClass: that.getOwnerComponent().getContentDensityClass()
							});
						}
					}

					if (bSuccess) {
//						that._partnersList.removeAllRows();
//						that._taxCostsList.removeAllRows();
//						that._feeCostsList.removeAllRows();
//						that._authoritiesList.removeAllRows();

						var oOwnerComponent = that.getOwnerComponent();
						var oDetailView = oOwnerComponent._oViews._oViews["huawei.cbs.det004.view.Detail"];
						var oDetailController = oDetailView.getController();
						oDetailController.getModel().deleteCreatedEntry(oDetailController.getView().getBindingContext());
						oDetailController.getView().unbindElement();
						oDetailController._bindView("/" + that.sDetailPath);

						MessageBox.information(that.getResourceBundle().getText("success" + sAction + "Item"), {
							styleClass: that.getOwnerComponent().getContentDensityClass()
						});
						that._toggleButtonsAndView(false);
						that.getRouter().navTo("detail", {
							BUSTYPE: that._sBusinessType,
							INDEI: that._sImpExpIndicator,
							detailId: that._sDeclarationId
						});
					}
					oViewModel.setProperty("/busy", false);
				}
			});
		},

		_toggleButtonsAndView: function(bEdit) {
			var oItemCode = that.byId("itemCodeInput");
			var oHsCode = that.byId("hsCodeInput");
			var oQtyInput = that.byId("qtyInput");
			var oBOEQtyInput = that.byId("boeQtyInput");

			var aControls = [
				{ control: that.byId("itemCodeInput") },
				{ control: that.byId("qtyInput") }
			];

			var oViewModel = that.getModel("itemView");
			var sCountry = oViewModel.getProperty("/detCountry");
			var sBusinessType = oViewModel.getProperty("/detBusinessType");
			var sImportOrExport = oViewModel.getProperty("/detImportOrExport");
			if (sCountry === "HK" && sBusinessType === "20" && sImportOrExport === "2") {
				aControls.push({ control: that.byId("coOSelect") });
				aControls.push({ control: that.byId("packageQtyInput") });
				aControls.push({ control: that.byId("packageTypeSelect") });
			}

			if (bEdit) {
				oItemCode.attachChange(that.onItemCodeChange);
				oHsCode.attachChange(that.onItemQuantityChange);
				oQtyInput.attachChange(that.onItemQuantityChange);

				oQtyInput.attachChange(that.onItemBOEQtyChange);
				oBOEQtyInput.attachChange(that.onItemBOEQtyChange);

				oItemCode.attachInnerControlsCreated(that.onInnerControlsCreated);
				oHsCode.attachInnerControlsCreated(that.onInnerControlsCreated);
				oQtyInput.attachInnerControlsCreated(that.onInnerControlsCreated);

				jQuery.each(aControls, function(i, oObject) {
					that.registerToMessageManager(oObject);
				});

				var aSelects = [
					{ control: that.byId("coOSelect") },
					{ control: that.byId("tradeTermSelect") },
					{ control: that.byId("packageTypeSelect") }
				];

				jQuery.each(aSelects, function(i, oObject) {
					that.addSelectClearButton(oObject);
				});
			} else {
				if (oItemCode) {
					oItemCode.detachChange(that.onItemCodeChange);
				}
				if (oHsCode) {
					oHsCode.detachChange(that.onItemQuantityChange);
				}
				if (oQtyInput) {
					oQtyInput.detachChange(that.onItemQuantityChange);
					oQtyInput.detachChange(that.onItemBOEQtyChange);
				}
				if (oBOEQtyInput) {
					oBOEQtyInput.detachChange(that.onItemBOEQtyChange);
				}

				jQuery.each(aControls, function(i, oObject) {
					that.unregisterToMessageManager(oObject);
				});
			}
		},

		/**
		 * Set the full screen mode to false and navigate to master page
		 */
		onCloseItemPress: function() {
			MessageBox.confirm(that.getResourceBundle().getText("confirmToDiscard"), {
				styleClass: that.getOwnerComponent().getContentDensityClass(),
				actions: [MessageBox.Action.YES, MessageBox.Action.NO],
				onClose: function(oAction) {
					if (oAction === MessageBox.Action.YES) {
						sap.ui.getCore().getMessageManager().removeAllMessages();
						that.getModel().deleteCreatedEntry(that.getView().getBindingContext());
						that._toggleButtonsAndView(false);
						that.navTo("detail");
					}
				}
			});
		}
	});

	return itemController;
});
