/*global location */
sap.ui.define([
	"huawei/cbs/det004/controller/BaseController",
	"huawei/cbs/det004/controller/QuotationValueHelper",
	"huawei/cbs/det004/model/formatter",
	"huawei/cbs/det004/model/validator",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/UploadCollectionParameter",
	"sap/m/library",
	"sap/m/Button",
	"sap/ui/Device",
	"sap/ui/core/format/FileSizeFormat",
	"sap/ui/core/format/DateFormat",
	"sap/ui/model/Filter",
	"sap/ui/table/Row",
	"sap/m/MessagePopover",
	"sap/m/MessagePopoverItem"
], function(
	BaseController,
	QuotationValueHelper,
	formatter,
	validator,
	JSONModel,
	MessageToast,
	MessageBox,
	UploadCollectionParameter,
	MobileLibrary,
	Button,
	Device,
	FileSizeFormat,
	DateFormat,
	Filter,
	Row,
	MessagePopover,
	MessagePopoverItem
) {
	"use strict";

	var that;

	var detailController = BaseController.extend("huawei.cbs.det004.controller.DetailCreate", {
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
				documentSelected: false,
				partnerSelected: false,
				costSelected: false,
				attachSelected: false,
				docTypeSelected: false,
				itemSelected: false,
				lineItemListTitle: that.getResourceBundle().getText("detailLineItemTableHeading")
			});
			oViewModel.setDefaultBindingMode(sap.ui.model.BindingMode.TwoWay);
			that.setModel(oViewModel, "detailView");

			that._documentsList = that.byId("documentsList");
			that._partnersList = that.byId("partnersList");
			that._taxCostsList = that.byId("taxCostsList");
			that._feeCostsList = that.byId("feeCostsList");

			that._fragmentPrefix = "huawei.cbs.det004.fragment.";

			that._documentDialog = sap.ui.xmlfragment(that.getView().getId(), that._fragmentPrefix + "DocumentDialog", this);
			that.getView().addDependent(that._documentDialog);

			that._partnerDialog = sap.ui.xmlfragment(that.getView().getId(), that._fragmentPrefix + "PartnerDialog", this);
			that.getView().addDependent(that._partnerDialog);

			that._costDialog = sap.ui.xmlfragment(that.getView().getId(), that._fragmentPrefix + "CostDialog", this);
			that.getView().addDependent(that._costDialog);

			that._settingsDialog = sap.ui.xmlfragment(that.getView().getId(), that._fragmentPrefix + "DocumentSettingsDialog", this);
			that.getView().addDependent(that._settingsDialog);

			that._generateDocDialog = sap.ui.xmlfragment(that.getView().getId(), that._fragmentPrefix + "GenerateDocDialog", this);
			that.getView().addDependent(that._generateDocDialog);
			that._docGenerateList = that.byId("docGenerateList");

			that.oLineItemTable = that.byId("itemTable");

			that.oUploadCollection = that.byId("UploadCollection");

			that.byId("feeCostSmartTable").applyVariant({
				sort: {
					sortItems: [{
						columnKey: "Tlc_Aart",
						operation: "Ascending"}
					]
				}
			});
			that.byId("itemSmartTable").applyVariant({
				sort: {
					sortItems: [{
						columnKey: "ProductNo",
						operation: "Ascending"}
					]
				}
			});

			// Attachment
			that.getView().setModel(new JSONModel({
				"maximumFilenameLength": 55,
				"maximumFileSize": 10,
				"mode": MobileLibrary.ListMode.MultiSelect,
				"uploadEnabled": true,
				"uploadButtonVisible": true,
				"enableEdit": false,
				"enableDelete": false,
				"visibleEdit": false,
				"visibleDelete": false,
				"listSeparatorItems": [
					MobileLibrary.ListSeparators.All
				],
				"showSeparators": MobileLibrary.ListSeparators.All,
				"listModeItems": [
					{
						"key": MobileLibrary.ListMode.MultiSelect,
						"text": "Multi"
					}
				]
			}), "settings");

			that.getView().setModel(new JSONModel({
				"items": ["jpg", "txt", "ppt", "pptx", "doc", "docx", "xls", "xlsx", "pdf", "png"],
				"selected": ["jpg", "txt", "ppt", "pptx", "doc", "docx", "xls", "xlsx", "pdf", "png"]
			}), "fileTypes");

			that.getRouter().getRoute("detailCreate").attachPatternMatched(that._onDetailMatched, this);
			that.getOwnerComponent().getModel().metadataLoaded().then(that._onMetadataLoaded.bind(this));
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Updates the item count within the line item table's header
		 * @param {object} oEvent an event containing the total number of items in the list
		 * @private
		 */
		onListUpdateFinished: function(oEvent) {
			var sTitle,
				iTotalItems = oEvent.getParameter("total"),
				oViewModel = that.getModel("detailView"),
				oItemsBinding = oEvent.getSource().getBinding("items");

			// only update the counter if the length is final
			if (oItemsBinding.isLengthFinal()) {
				if (iTotalItems) {
					sTitle = that.getResourceBundle().getText("detailLineItemTableHeadingCount", [iTotalItems]);
				} else {
					// Display 'Line Items' instead of 'Line items (0)'
					sTitle = that.getResourceBundle().getText("detailLineItemTableHeading");
				}
				oViewModel.setProperty("/detailLineItemListTitle", sTitle);
			}
		},

		onDeclarationCompanyChange: function(oEvent) {
			var oItem = oEvent.getParameters("selectedItem");
			var sCompanyBpID = oItem.selectedItem.getKey();
			var hkCompanies = that.getHkCompanies().oData;
			var sCompanyID = "";
			for (var i in hkCompanies) {
				var hkCompany = hkCompanies[i];
				if (hkCompany.CompanyBpID === sCompanyBpID) {
					sCompanyID = hkCompany.CompanyID;
				}
			}
			var oContext = that.getView().getBindingContext();
			that.getModel().setProperty(oContext.sPath + "/CompanyID", sCompanyID);
		},

		onInvoiceCurrencyChange: function(oEvent) {
			var oValue = oEvent.getParameters("value");
			var sCurrency = oValue.newValue;
			var oContext = that.getView().getBindingContext();
			that.getModel().setProperty(oContext.sPath + "/HTMReferenceAmountCurrency", sCurrency);
			that.getModel().setProperty(oContext.sPath + "/FreightAmountCurrency", sCurrency);
			that.getModel().setProperty(oContext.sPath + "/HTMReferenceFreightCurrency", sCurrency);
			that.getModel().setProperty(oContext.sPath + "/InsuranceAmountCurrency", sCurrency);
			that.getModel().setProperty(oContext.sPath + "/HTMReferenceInsuranceCurrency", sCurrency);
			that.getModel().setProperty(oContext.sPath + "/FOBAmountCurrency", sCurrency);
		},

		onExchangeRateChange: function(oEvent) {
			var value = oEvent.getParameters("value").newValue;
			var oContext = that.getView().getBindingContext();
			if (value && value.length > 0) {
				var fInvoiceAmount = parseFloat(that.getModel().getProperty(oContext.sPath + "/InvoiceAmount"));
				var fBOEAmount = fInvoiceAmount * parseFloat(value);
				var sBOEAmount = Math.round(fBOEAmount * 100) / 100;
				that.getModel().setProperty(oContext.sPath + "/BOEAmount", Number(sBOEAmount).toString());
			} else {
				that.getModel().setProperty(oContext.sPath + "/BOEAmount", "0.00");
			}
		},

		onDeparturePortChange: function(oEvent) {
			if (that.byId("departurePortSelect").getValue() === "") {
				that._setDeparturePortReadonly(false);
			} else {
				that._setDeparturePortReadonly(true);
			}
		},

		onDeparturePortClear: function(oEvent) {
			that.byId("departurePortSelect").setValue("");
			that.byId("departurePortTxtInput").setValue("");
			var oContext = that.getView().getBindingContext();
			that.getModel().setProperty(oContext.sPath + "/DeparturePort", "");
			that.getModel().setProperty(oContext.sPath + "/DeparturePortTxt", "");
			that._setDeparturePortReadonly(false);
		},

		onTransitPortClear: function(oEvent) {
			that.byId("transitPortSelect").setValue("");
			that.byId("transitPortTxtInput").setValue("");
			var oContext = that.getView().getBindingContext();
			that.getModel().setProperty(oContext.sPath + "/TransitPort", "");
			that.getModel().setProperty(oContext.sPath + "/TransitPortTxt", "");
			that._setTransitPortReadonly();
		},

		onDestinationPortClear: function(oEvent) {
			that.byId("destinationPortSelect").setValue("");
			that.byId("destinationPortTxtInput").setValue("");
			var oContext = that.getView().getBindingContext();
			that.getModel().setProperty(oContext.sPath + "/DestinationPort", "");
			that.getModel().setProperty(oContext.sPath + "/DestinationPortTxt", "");
			that._setDestinationPortReadonly();
		},

		onFinalDestinationClear: function(oEvent) {
			that.byId("finalDestinationSelect").setValue("");
			that.byId("finalDestinationTxtInput").setValue("");
			var oContext = that.getView().getBindingContext();
			that.getModel().setProperty(oContext.sPath + "/FinalDestination", "");
			that.getModel().setProperty(oContext.sPath + "/FinalDestinationTxt", "");
			that._setFinalDestinationReadonly();
		},

		onSave: function() {
			var oViewModel = that.getModel("detailView");
			var sBusinessType = oViewModel.getProperty("/BusinessType");
			var sImportOrExport = oViewModel.getProperty("/ImportOrExport");
			var sCountry = oViewModel.getProperty("/Country");

			var aSmartFields = [
				{ control: that.byId("departureCountrySelect") },
				{ control: that.byId("totalGrossWeightInput") },
				{ control: that.byId("totalNetWeightInput") },
				{ control: that.byId("totalVolumeInput") }
			];
			if (!(sCountry === "HK" && sBusinessType === "20" && sImportOrExport === "1")) {
				aSmartFields.push({ control: that.byId("transitCountrySelect") });
				aSmartFields.push({ control: that.byId("transitPortSelect") });
				aSmartFields.push({ control: that.byId("destinationCountrySelect") });
				aSmartFields.push({ control: that.byId("destinationPortSelect") });
				aSmartFields.push({ control: that.byId("finalDestinationSelect") });
			}
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

							sap.ui.getCore().getMessageManager().removeAllMessages();
							// collect input controls
							var aInputs = [
								{ control: that.byId("invoiceCurrencyInput"), label: that.getResourceBundle().getText("detailGeneralLabelInvoiceCurrency") },
								{ control: that.byId("BOECurrencyInput"), label: that.getResourceBundle().getText("detailGeneralLabelBOECurrency") }								
							];
							if (sImportOrExport === "1") {
								aInputs.push( { control: that.byId("departureCountrySelect"), label: that.getResourceBundle().getText("detailTransportationLabelDepartureCountry") } );
								aInputs.push({ control: that.byId("importDatePicker"), label: that.getResourceBundle().getText("detailTransportationLabelHKImportDate") });
							}
							if (sImportOrExport === "2") {
								aInputs.push({ control: that.byId("departureDatePicker"), label: that.getResourceBundle().getText("detailTransportationLabelHKDepartureDate") });
							}
							if (sCountry === "HK" && sBusinessType === "20" && sImportOrExport === "1") {
								aInputs.push({ control: that.byId("mawbInput"), label: that.getResourceBundle().getText("detailTransportationLabelMAWB") });
								aInputs.push({ control: that.byId("hawbInput"), label: that.getResourceBundle().getText("detailTransportationLabelHAWB") });
							}
							var aSelects = [
								{ control: that.byId("declarationCompanySelect"), label: that.getResourceBundle().getText("detailGeneralLabelDeclarationCompany") },
								{ control: that.byId("modeOfTransportSelect"), label: that.getResourceBundle().getText("detailTransportationLabelModeOfTransport") }
							];
							if (that._sCountry !== "HK") {
								aSelects.push({ control: that.byId("tradeTermSelect"), label: that.getResourceBundle().getText("detailGeneralLabelTradeTerm") });
							}
							var aNumbers = [
								{ control: that.byId("exchangeRateInput") },
								{ control: that.byId("freightAmountInput") },
								{ control: that.byId("insuranceAmountInput") },
								{ control: that.byId("totalGrossWeightInput") },
								{ control: that.byId("totalNetWeightInput") },
								{ control: that.byId("totalVolumeInput") }
							];
							var bValidationError = false;

							// check that inputs are not empty
							// this does not happen during data binding as this is only triggered by changes
							jQuery.each(aInputs, function(i, oObject) {
								bValidationError = validator.validateInput(oObject) || bValidationError;
							});
							if (sCountry === "HK" && sBusinessType === "20" && sImportOrExport === "1") {
								bValidationError = validator.validatePort({ control: that.byId("departurePortSelect"), label: that.getResourceBundle().getText("detailTransportationLabelDeparturePort") }, { control: that.byId("departurePortTxtInput"), label: that.getResourceBundle().getText("detailTransportationLabelDeparturePort") }) || bValidationError;
							}
							jQuery.each(aSelects, function(i, oObject) {
								bValidationError = validator.validateSelect(oObject) || bValidationError;
							});
							jQuery.each(aNumbers, function(i, oObject) {
								bValidationError = validator.validateNumber(oObject) || bValidationError;
							});

							if (!bValidationError) {
								that._saveDocument("CREATE");
							} else {
								oViewModel.setProperty("/busy", false);
							}
						}
					}
				});
			}
		},

		onCancel: function() {
			that.onCloseDetailPress();
		},

		onGenerate: function() {
			that._generateDocDialog.open();
		},

		onDocGenerateSelectionChange: function(oEvent) {
			var oViewModel = that.getModel("detailView");
			var selectedItem = oEvent.getSource().getSelectedItem();
			if (selectedItem) {
				var docType = selectedItem.getCells()[1].getText();
				oViewModel.setProperty("/selectedDocType", docType);
				oViewModel.setProperty("/docTypeSelected", true);
			} else {
				oViewModel.setProperty("/docTypeSelected", false);
			}
		},

		onDocGenerateClose: function() {
			var oViewModel = that.getModel("detailView");
			oViewModel.setProperty("/docTypeSelected", false);
			that._docGenerateList.removeSelections();
			that._generateDocDialog.close();
		},

		onDocGeneratePreview: function() {
			var oViewModel = that.getModel("detailView");
			var docType = oViewModel.getProperty("/selectedDocType");

			var sType = docType.toUpperCase();
			if (sType === "INVOICE") {
				if (that._sCountry === "AE" || that._sCountry === "Z1") {
					sType = sType + "_DUBAI";
				} else if (that._sCountry === "SA") {
					sType = sType + "_SAUDI";
				}
			}
			var sHeaderID = that.sanitizeGuid(that._sDeclarationId);
			var sURL = "/sap/opu/odata/sap/ZCBS_DET_SRV/ZcbsAdobeFormDownloadSet(FileName='" + docType + ".pdf',DownTempType='" + sType + "',HeaderID='" + sHeaderID + "')/$value";
			sap.m.URLHelper.redirect(sURL, true);

			oViewModel.setProperty("/docTypeSelected", false);
			that._docGenerateList.removeSelections();
			that._generateDocDialog.close();
		},

		onDocGenerateCancel: function() {
			var oViewModel = that.getModel("detailView");
			oViewModel.setProperty("/docTypeSelected", false);
			that._docGenerateList.removeSelections();
			that._generateDocDialog.close();
		},

		// Document Section Start
		onDocumentSelectionChange: function(oEvent) {
			var oViewModel = that.getModel("detailView");
			var selectedItems = oEvent.getSource().getSelectedIndices();
			if (selectedItems.length <= 0) {
				oViewModel.setProperty("/documentSelected", false);
			} else {
				oViewModel.setProperty("/documentSelected", true);
			}
		},

		onDocumentSettings: function() {
			// Open the Table Setting dialog 
			that._settingsDialog.open();
		},

		onDocumentSettingsConfirm: function() {
			var oDocumentName = that._settingsDialog.getFilterItems()[0].getCustomControl();
			var fDocumentNameFilterValue = oDocumentName.getValue();

			var oDocumentNo = that._settingsDialog.getFilterItems()[1].getCustomControl();
			var fDocumentNoFilterValue = oDocumentNo.getValue();

			var oView = that.getView();
			var oTable = oView.byId("documentsList");
			var oBinding = oTable.getBinding("rows");

			// apply filters
			var aFilters = [];
			if (fDocumentNameFilterValue != null && fDocumentNameFilterValue !== "") {
				aFilters.push(new sap.ui.model.Filter("DocumentName", "Contains", fDocumentNameFilterValue, ""));
			}
			if (fDocumentNoFilterValue != null && fDocumentNoFilterValue !== "") {
				aFilters.push(new sap.ui.model.Filter("DocumentNo", "Contains", fDocumentNoFilterValue, ""));
			}
			oBinding.filter(aFilters);

			that._settingsDialog.close();
		},

		onDocumentSettingsCancel: function() {
			that._settingsDialog.close();
		},

		onDocumentSettingsResetFilters: function() {
			var oCustomFilters = that._settingsDialog.getFilterItems();

			var oDocumentName = oCustomFilters[0].getCustomControl();
			var oDocumentNo = oCustomFilters[1].getCustomControl();

			oCustomFilters[0].setFilterCount(0);
			oCustomFilters[0].setSelected(false);

			oCustomFilters[1].setFilterCount(0);
			oCustomFilters[1].setSelected(false);

			oDocumentName.setValue("");
			oDocumentNo.setValue("");
		},

		onDocumentTypeChange: function(oEvent) {
			var oItem = oEvent.getParameters("selectedItem");
			var sDocumentName = oItem.selectedItem.mProperties.text;
			var sDocumentType = oItem.selectedItem.mProperties.additionalText;

			var oContext = that._documentDialog.getBindingContext();

			that.getModel().setProperty(oContext.sPath + "/DocumentName", sDocumentName);
			that.getModel().setProperty(oContext.sPath + "/DocumentType", sDocumentType);

			that._documentDialog.setBindingContext(oContext);
			that._documentDialog.bindElement(oContext.sPath);
		},

		_origDocs: {},

		onDocumentAdd: function() {
			for (var i in that._documentsList.getRows()) {
				var d = that._documentsList.getRows()[i].getBindingContext().getObject();
				var guid = d.LegdocID;
				var type = d.DocumentType;
				var name = d.DocumentName;
				var no = d.DocumentNo;
				that._origDocs[guid] = {DocumentType: type, DocumentName: name, DocumentNo: no};
			}

			var oViewModel = that.getModel("detailView");
			oViewModel.setProperty("/new", true);
			var oContext = that.getModel().createEntry("/ZCBS_C_DETDOC", {
				properties: {
					LegdocID: that.guid(),
					DocumentType: "",
					DocCategory: "HDOC",
					DocumentName: "",
					DocumentSeq: "",
					DocumentNo: "",
					HeaderID: that._sDeclarationId,
					LegdocObject: "O1"
				}
			});

			that._documentDialog.setBindingContext(oContext);
			that._documentDialog.bindElement(oContext.sPath);
			that._documentDialog.open();
		},

		onDocumentEdit: function(oEvent) {
			for (var i in that._documentsList.getRows()) {
				var d = that._documentsList.getRows()[i].getBindingContext().getObject();
				var guid = d.LegdocID;
				var type = d.DocumentType;
				var name = d.DocumentName;
				var no = d.DocumentNo;
				that._origDocs[guid] = {DocumentType: type, DocumentName: name, DocumentNo: no};
			}

			var oViewModel = that.getModel("detailView");
			oViewModel.setProperty("/new", false);
			var oContext = oEvent.getSource().getParent().getBindingContext();

			that._documentDialog.setBindingContext(oContext);
			that._documentDialog.bindElement(oContext.sPath);
			that._documentDialog.open();
		},

		onDocumentDelete: function() {
			MessageBox.warning(that.getResourceBundle().getText("confirmToDelete"), {
				styleClass: that.getOwnerComponent().getContentDensityClass(),
				actions: [MessageBox.Action.YES, MessageBox.Action.NO],
				onClose: function(oAction) {
					if (oAction === MessageBox.Action.YES) {
						var oViewContext = that.getView().getBindingContext();
						var selectedItems = that._documentsList.getSelectedIndices().reverse();
						var oModel = that.getModel();
						var oData = oModel.getProperty("to_DETDOC", oViewContext);
						for (var i in selectedItems) {
							var oContext = that._documentsList.getContextByIndex(selectedItems[i]);
							var sDeleteItemPath = oContext.getPath().slice(1);
							var doc = oContext.getObject();
							if (doc.DocumentType !== "CONNO" && doc.DocumentType !== "PCKLT" && doc.DocumentType !== "CUSPO") {
								var index = oData.indexOf(sDeleteItemPath);
								if (index !== -1) {
									oData.splice(index, 1);
								}
							}
							var array = [];
							for (var j in that._headerDocArray) {
								var headerDoc = that._headerDocArray[j];
								if (headerDoc.DocumentType === "CONNO" || headerDoc.DocumentType === "PCKLT" || headerDoc.DocumentType === "CUSPO") {
									array.push(headerDoc);
								} else {
									if (headerDoc.LegdocID !== doc.LegdocID) {
										array.push(headerDoc);
									}
								}
							}
							that._headerDocArray = array;
						}
						oModel.setProperty("to_DETDOC", oData, oViewContext);
						that._documentsList.setSelectedIndex(-1);
						MessageToast.show(that.getResourceBundle().getText("successDELETE"));
					}
				}
			});
		},

		_newAddedDocs: [],

		onDocumentSave: function() {
			var oViewContext = that.getView().getBindingContext();
			var oContext = that._documentDialog.getBindingContext();
			var doc = oContext.getObject();
			var documentType = doc.DocumentType;
			var documentNo = doc.DocumentNo;
			if (documentType && documentNo) {
				var array = [];
				var found = false;
				for (var i in that._headerDocArray) {
					var headerDoc = that._headerDocArray[i];
					if (headerDoc.LegdocID === doc.LegdocID) {
						array.push(doc);
						found = true;
					} else {
						array.push(headerDoc);
					}
				}
				if (!found) {
					array.push(doc);

					if (!that.getModel().getProperty("to_DETDOC", oViewContext)) {
						that.getModel().setProperty("to_DETDOC", [oContext.getPath().slice(1)], oViewContext);
					} else {
						var aNewPathArray = that.getModel().getProperty("to_DETDOC", oViewContext).concat([oContext.getPath().slice(1)]);
						that.getModel().setProperty("to_DETDOC", aNewPathArray, oViewContext);
					}
					that._newAddedDocs.push(oContext.getPath().slice(1));
				}

				that._headerDocArray = array;

				that._documentDialog.unbindElement();
				that._documentDialog.close();
			} else {
				MessageToast.show(that.getResourceBundle().getText("errorSaveNewDoc"));
			}
		},

		onDocumentCancel: function() {
			for (var i in that._documentsList.getRows()) {
				var oContext = that._documentsList.getRows()[i].getBindingContext();
				var guid = that.getModel().getProperty(oContext.sPath + "/LegdocID");
				that.getModel().setProperty(oContext.sPath + "/DocumentType", that._origDocs[guid].DocumentType);
				that.getModel().setProperty(oContext.sPath + "/DocumentName", that._origDocs[guid].DocumentName);
				that.getModel().setProperty(oContext.sPath + "/DocumentNo", that._origDocs[guid].DocumentNo);
			}

			that._documentDialog.unbindElement();
			that._documentDialog.close();
		},

		onDocumentClose: function() {
			that._documentDialog.unbindElement();
			that._documentDialog.close();
		},
		// Document Section End

		// Partner Section Start
		onPartnerSelectionChange: function(oEvent) {
			var oViewModel = that.getModel("detailView");
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

			var oViewModel = that.getModel("detailView");
			oViewModel.setProperty("/new", true);
			var oContext = that.getModel().createEntry("/ZCBS_C_DETBP", {
				properties: {
					ParID: that.guid(),
					ParGUID: "",
					ParObject: "O1",
					HeaderID: that._sDeclarationId,
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

			var oViewModel = that.getModel("detailView");
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
						var oData = that.getModel().getProperty("to_DETBP", oViewContext);
						for (var i in selectedItems) {
							var oContext = that._partnersList.getContextByIndex(selectedItems[i]);
							var sDeleteItemPath = oContext.getPath().slice(1);
							var bp = oContext.getObject();

							var index = oData.indexOf(sDeleteItemPath);
							if (index !== -1) {
								oData.splice(index, 1);
							}

							var array = [];
							for (var j in that._headerBpArray) {
								var headerBp = that._headerBpArray[j];
								if (headerBp.ParID !== bp.ParID) {
									array.push(headerBp);
								}
							}
							that._headerBpArray = array;
						}
						oModel.setProperty("to_DETBP", oData, oViewContext);
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
				for (var i in that._headerBpArray) {
					var headerBp = that._headerBpArray[i];
					if (headerBp.ParID === bp.ParID) {
						array.push(bp);
						found = true;
					} else {
						array.push(headerBp);
					}
				}
				if (!found) {
					array.push(bp);

					if (!that.getModel().getProperty("to_DETBP", oViewContext)) {
						that.getModel().setProperty("to_DETBP", [oContext.getPath().slice(1)], oViewContext);
					} else {
						var aNewPathArray = that.getModel().getProperty("to_DETBP", oViewContext).concat([oContext.getPath().slice(1)]);
						that.getModel().setProperty("to_DETBP", aNewPathArray, oViewContext);
					}
					that._newAddedPartners.push(oContext.getPath().slice(1));
				}

				that._headerBpArray = array;

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

		onBeforeRebindPartnerTable: function(oEvent) {
			var mBindingParams = oEvent.getParameter("bindingParams");
			var aFilter = new sap.ui.model.Filter([
				new sap.ui.model.Filter("ParObjectType", sap.ui.model.FilterOperator.NE, "CUSLCB"),
				new sap.ui.model.Filter("ParObjectType", sap.ui.model.FilterOperator.NE, "CUSVBS")
			], true);
			mBindingParams.filters = aFilter;
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

		onQuotationValueHelpRequest: function() {
			that._valuehelp.openValueHelp("/items",
				function(selection, ctx) {
					var oContext = ctx.getView().getBindingContext();
					ctx.getModel().setProperty(oContext.sPath + "/QuotationNo", selection.Quotation);
					ctx.getModel().setProperty(oContext.sPath + "/QuotationNoCurrency", selection.Currency);
				},
				function(ctx) {
					// console.log("cancel");
				},
				this
			);
		},

		onClearQuotation: function() {
			that.byId("quotationNoInput").setValue("");
		},
		// Cost Section End

		// Attachment Section Start
		onChange: function(oEvent) {
			var oUploadCollection = oEvent.getSource();
			// Header Token
			var oCustomerHeaderToken = new UploadCollectionParameter({
				name: "x-csrf-token",
				value: that.getModel().getSecurityToken()
			});
			oUploadCollection.addHeaderParameter(oCustomerHeaderToken);

			var sHeaderID = that.sanitizeGuid(that._sDeclarationId);
			var oFileUploader = oUploadCollection._getFileUploader();
			// Below is a hack of upload using PUT instead of POST along with dynamic upload url as well,
			// Please change this function with EXTREME CAUTIONS!!!
			// Version - 1.52.9
			oFileUploader._sendFilesWithXHR = function(aFiles) {
				var iFiles,
				sHeader,
				sValue,
				oXhrEntry,
				oXHRSettings = oFileUploader.getXhrSettings();

				if (aFiles.length > 0) {
					if (oFileUploader.getUseMultipart()) {
						//one xhr request for all files
						iFiles = 1;
					} else {
						//several xhr requests for every file
						iFiles = aFiles.length;
					}
					// Save references to already uploading files if a new upload comes between upload and complete or abort
					oFileUploader._aXhr = oFileUploader._aXhr || [];
					for (var j = 0; j < iFiles; j++) {
						//keep a reference on the current upload xhr
						oFileUploader._uploadXHR = new window.XMLHttpRequest();

						oXhrEntry = {
							xhr: oFileUploader._uploadXHR,
							requestHeaders: []
						};
						oFileUploader._aXhr.push(oXhrEntry);
						oXhrEntry.xhr.open("PUT", "/sap/opu/odata/sap/ZCBS_DET_SRV/ZCBS_UPLOADTEMPSet(AttachmentID='DUMMY',GUID_POBJ='" + sHeaderID + "',FileName='" + encodeURIComponent(aFiles[j].name) + "')/$value", true);
						if (oXHRSettings) {
							oXhrEntry.xhr.withCredentials = oXHRSettings.getWithCredentials();
						}
						if (oFileUploader.getHeaderParameters()) {
							var aHeaderParams = oFileUploader.getHeaderParameters();
							for (var i = 0; i < aHeaderParams.length; i++) {
								sHeader = aHeaderParams[i].getName();
								sValue = aHeaderParams[i].getValue();
								oXhrEntry.requestHeaders.push({
									name: sHeader,
									value: sValue
								});
							}
						}
						var sFilename = encodeURIComponent(aFiles[j].name);
						var aRequestHeaders = oXhrEntry.requestHeaders;
						oXhrEntry.fileName = sFilename;
						oXhrEntry.file = aFiles[j];
						oFileUploader.fireUploadStart({
							"fileName": sFilename,
							"requestHeaders": aRequestHeaders
						});
						for (var k = 0; k < aRequestHeaders.length; k++) {
							// Check if request is still open in case abort() was called.
							if (oXhrEntry.xhr.readyState === 0) {
								break;
							}
							sHeader = aRequestHeaders[k].name;
							sValue = aRequestHeaders[k].value;
							oXhrEntry.xhr.setRequestHeader(sHeader, sValue);
						}
					}
					if (oFileUploader.getUseMultipart()) {
						var formData = new window.FormData();
						var name = oFileUploader.FUEl.name;
						for (var l = 0; l < aFiles.length; l++) {
							formData.append(name, aFiles[l], aFiles[l].name);
						}
						formData.append("_charset_", "UTF-8");
						var data = oFileUploader.FUDataEl.name;
						if (oFileUploader.getAdditionalData()) {
							var sData = oFileUploader.getAdditionalData();
							formData.append(data, sData);
						} else {
							formData.append(data, "");
						}
						if (oFileUploader.getParameters()) {
							var oParams = oFileUploader.getParameters();
							for (var m = 0; m < oParams.length; m++) {
								var sName = oParams[m].getName();
								sValue = oParams[m].getValue();
								formData.append(sName, sValue);
							}
						}
						oXhrEntry.file = formData;
						oFileUploader.sendFiles(oFileUploader._aXhr, 0);
					} else {
						oFileUploader.sendFiles(oFileUploader._aXhr, 0);
					}
					oFileUploader._bUploading = false;
					oFileUploader._resetValueAfterUploadStart();
				}

				return oFileUploader;
			};
			oUploadCollection._oFileUploader = oFileUploader;
		},

		onFileDeleted: function(oEvent) {
			that.deleteItemById(oEvent.getParameter("documentId"));
		},

		deleteItemById: function(sItemToDeleteId) {
			var oData = that.oUploadCollection.getModel("attachment").getData();
			var aItems = jQuery.extend(true, {}, oData).items;
			jQuery.each(aItems, function(index) {
				if (aItems[index] && aItems[index].AttachmentID === sItemToDeleteId) {
					aItems.splice(index, 1);

					that.getModel().remove("/Zcbs_C_DETAttachment(AttachmentID=guid'" + sItemToDeleteId + "')", {
						groupId: "delete",
						success: function() {
							MessageToast.show("File successfully deleted.");
						}
					});
				}
			});
			that.oUploadCollection.getModel("attachment").setData({
				"items" : aItems
			});
			that.getView().byId("attachmentTitle").setText(that.getAttachmentTitleText());
		},

		deleteMultipleItems: function(aItemsToDelete) {
			var oData = that.oUploadCollection.getModel("attachment").getData();
			var nItemsToDelete = aItemsToDelete.length;
			var aItems = jQuery.extend(true, {}, oData).items;
			var i = 0;
			jQuery.each(aItems, function(index) {
				if (aItems[index]) {
					for (i = 0; i < nItemsToDelete; i++) {
						if (aItems[index].AttachmentID === aItemsToDelete[i].getDocumentId()) {
							aItems.splice(index, 1);
						}
					}
				}
			});
			that.oUploadCollection.getModel("attachment").setData({
				"items" : aItems
			});
			that.getView().byId("attachmentTitle").setText(that.getAttachmentTitleText());
		},

		onFilenameLengthExceed: function() {
			MessageToast.show("Filename Length Exceed.");
		},

		onFileRenamed: function(oEvent) {
			var oData = that.oUploadCollection.getModel("attachment").getData();
			var aItems = jQuery.extend(true, {}, oData).items;
			var sDocumentId = oEvent.getParameter("documentId");
			jQuery.each(aItems, function(index) {
				if (aItems[index] && aItems[index].AttachmentID === sDocumentId) {
					aItems[index].fileName = oEvent.getParameter("item").getFileName();
				}
			});
			that.oUploadCollection.getModel("attachment").setData({
				"items" : aItems
			});
		},

		onFileSizeExceed: function() {
			MessageToast.show("File Size Exceeded.");
		},

		onTypeMissmatch: function() {
			MessageToast.show("File Type Missmatch.");
		},

		onUploadComplete: function(oEvent) {
			var oData = that.oUploadCollection.getModel("attachment").getData();

			oData.items.unshift({
				"AttachmentID": that.guid(),
				"Pobjt": "O1",
				"Guid_pobj": that._sDeclarationId,
				"FileName": oEvent.getParameter("files")[0].fileName,
				"FileType": "",
				"CreateDate": "",
				"CreateTime": "",
				"CreateBy": "",
				"FileURL": "",
				"FileID": ""
			});

			that.getModel().read("/" + that._sBindPath + "/to_Attachment", {
				success: function(oResult) {
					var array = [];
					var oArray = oResult.results;
					for (var i in oArray) {
						var oItem = oArray[i];
						oItem.FileURL = "/sap/opu/odata/sap/ZCBS_DET_SRV/ZCBS_UPLOADTEMPSet(AttachmentID='" + that.sanitizeGuid(oItem.AttachmentID) + "',FileName='" + oItem.FileName + "',GUID_POBJ='" + that.sanitizeGuid(oItem.Guid_pobj) + "')/$value";
						array.push(oItem);
					}
					that.oUploadCollection.getModel("attachment").setData({
						"items" : array
					});
					that.getView().getModel().refresh();

					// Sets the text to the label
					that.getView().byId("attachmentTitle").setText(that.getAttachmentTitleText());

					// Success message for to notice onChange message
					MessageToast.show("File successfully uploaded.");
				}
			});
		},

		onBeforeUploadStarts: function(oEvent) {
			// Header Slug
			var oCustomerHeaderSlug = new UploadCollectionParameter({
				name: "slug",
				value: oEvent.getParameter("fileName")
			});
			oEvent.getParameters().addHeaderParameter(oCustomerHeaderSlug);
		},

		onUploadTerminated: function() {
			/*
			// get parameter file name
			var sFileName = oEvent.getParameter("fileName");
			// get a header parameter (in case no parameter specified, the callback function getHeaderParameter returns all request headers)
			var oRequestHeaders = oEvent.getParameters().getHeaderParameter();
			*/
		},

		onFileTypeChange: function(oEvent) {
			that.oUploadCollection.setFileType(oEvent.getSource().getSelectedKeys());
		},

		onModeChange: function(oEvent) {
			var oSettingsModel = that.getView().getModel("settings");
			if (oEvent.getParameters().selectedItem.getProperty("key") === MobileLibrary.ListMode.MultiSelect) {
				oSettingsModel.setProperty("/visibleEdit", false);
				oSettingsModel.setProperty("/visibleDelete", false);
				that.enableToolbarItems(true);
			} else {
				oSettingsModel.setProperty("/visibleEdit", true);
				oSettingsModel.setProperty("/visibleDelete", true);
				that.enableToolbarItems(false);
			}
		},

		enableToolbarItems: function(status) {
			that.getView().byId("deleteSelectedButton").setVisible(status);
			// This is only enabled if there is a selected item in multi-selection mode
			if (that.oUploadCollection.getSelectedItems().length > 0) {
				that.getView().byId("deleteSelectedButton").setEnabled(true);
			}
		},

		onDeleteSelectedItems: function() {
			MessageBox.warning(that.getResourceBundle().getText("confirmToDelete"), {
				styleClass: that.getOwnerComponent().getContentDensityClass(),
				actions: [MessageBox.Action.YES, MessageBox.Action.NO],
				onClose: function(oAction) {
					if (oAction === MessageBox.Action.YES) {
						var aSelectedItems = that.oUploadCollection.getSelectedItems();
						if (aSelectedItems.length > 0) {
							for (var i in aSelectedItems) {
								var aSelectedItem = aSelectedItems[i];

								that.getModel().remove("/Zcbs_C_DETAttachment(AttachmentID=guid'" + aSelectedItem.getDocumentId() + "')", {
									groupId: "delete_" + i
								});
							}
						}
						that.deleteMultipleItems(aSelectedItems);
						var aItems = that.oUploadCollection.getItems();
						for (var j = 0; j < aItems.length; j++) {
							that.oUploadCollection.setSelectedItem(aItems[j], false);
						}
						that.getView().byId("deleteSelectedButton").setEnabled(false);
						MessageToast.show("File successfully deleted.");
					}
				}
			});
		},

		onSelectionChange: function() {
			// Only it is enabled if there is a selected item in multi-selection mode
			if (that.oUploadCollection.getMode() === MobileLibrary.ListMode.MultiSelect) {
				if (that.oUploadCollection.getSelectedItems().length > 0) {
					that.getView().byId("deleteSelectedButton").setEnabled(true);
				} else {
					that.getView().byId("deleteSelectedButton").setEnabled(false);
				}
			}
		},
		// Attachment Section End

		onItemSelectionChange: function(oEvent) {
			var oViewModel = that.getModel("detailView");
			var selectedItems = oEvent.getSource().getSelectedIndices();
			if (selectedItems.length <= 0) {
				oViewModel.setProperty("/itemSelected", false);
			} else {
				oViewModel.setProperty("/itemSelected", true);
			}
		},

		onItemAdd: function() {
			// set the layout property of FCL control to show two columns
			that.getModel("appView").setProperty("/layout", "EndColumnFullScreen");
			that.getRouter().navTo("itemCreate", {
				BUSTYPE: that._sBusinessType,
				INDEI: that._sImpExpIndicator,
				detailId: that._sDeclarationId
			});
		},

		onItemDelete: function() {
			MessageBox.warning(that.getResourceBundle().getText("confirmToDelete"), {
				styleClass: that.getOwnerComponent().getContentDensityClass(),
				actions: [MessageBox.Action.YES, MessageBox.Action.NO],
				onClose: function(oAction) {
					if (oAction === MessageBox.Action.YES) {
						var oViewContext = that.getView().getBindingContext();
						var selectedItems = that.oLineItemTable.getSelectedIndices().reverse();
						var oModel = that.oLineItemTable.getModel();
						var oData = that.getModel().getProperty("to_DETI", oViewContext);
						for (var i in selectedItems) {
							var oContext = that.oLineItemTable.getContextByIndex(selectedItems[i]);
							var sDeleteItemPath = oContext.getPath().slice(1);
							var item = oContext.getObject();

							var index = oData.indexOf(sDeleteItemPath);
							if (index !== -1) {
								oData.splice(index, 1);
							}

							var array = [];
							for (var j in that._headerItemArray) {
								var headerItem = that._headerItemArray[j];
								if (headerItem.ItemID !== item.ItemID) {
									array.push(headerItem);
								}
							}
							that._headerItemArray = array;
						}
						oModel.setProperty("to_DETI", oData, oViewContext);
						that.oLineItemTable.setSelectedIndex(-1);
						that._saveDocument("DELETE");
					}
				}
			});
		},

		onItemPress: function(oEvent) {
			that._showItem(oEvent.getParameter("listItem") || oEvent.getSource());
		},

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
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'detail'
		 * @private
		 */
		_onDetailMatched: function(oEvent) {
			var sHeaderID = that.guid();
			var oViewModel = that.getModel("detailView");
			var oArguments = oEvent.getParameter("arguments");
			that._sBusinessType = oArguments.BUSTYPE;
			that._sImpExpIndicator = oArguments.INDEI;
			that._sCompanyBpId = oArguments.companyBpId;

			that.getModel().metadataLoaded().then(function() {
				that.getModel().setSizeLimit(500); // default is 100

				oViewModel.setProperty("/ImportOrExport", that._sImpExpIndicator);
				oViewModel.setProperty("/BusinessType", that._sBusinessType);

				if (that._sBusinessType != null && that._sBusinessType !== "") {
					that.getModel().read("/ZCBS_C_DMTEXT", {
						urlParameters: {
							$filter: "DomainName eq 'ZCBS_DM_BUS_TYP' and DomainValue eq '" + that._sBusinessType + "'"
						},
						success: function(oResult) {
							oViewModel.setProperty("/BusinessTypeText", oResult.results[0] ? oResult.results[0].ShortText : that._sBusinessType);
						}
					});
				} else {
					oViewModel.setProperty("/BusinessTypeText", "");
				}
				if (that._sImpExpIndicator != null && that._sImpExpIndicator !== "") {
					that.getModel().read("/ZCBS_C_DMTEXT", {
						urlParameters: {
							$filter: "DomainName eq '/SAPSLL/INDEI_EXCL' and DomainValue eq '" + that._sImpExpIndicator + "'"
						},
						success: function(oResult) {
							oViewModel.setProperty("/ImportOrExportText", oResult.results[0] ? oResult.results[0].ShortText : that._sImpExpIndicator);
						}
					});
				} else {
					oViewModel.setProperty("/ImportOrExportText", "");
				}

				var oContext = that.getModel().createEntry("/ZCBS_C_DETH", {
					properties: {
						HeaderID: sHeaderID,
						HeaderIDString: "",
						Action: "CREATE",
						DocumentNo: "",
						DocumentYear: "",
						ExternalDocumentNo: "",
						DocumentType: "",
						Country: "",
						BusinessType: that._sBusinessType,
						BusinessTypeTxt: "",
						ImportOrExport: that._sImpExpIndicator,
						ImportOrExportTxt: "",
						CreatedByUser: "",
						SubmitBy: "",
						LegalReg: "",
						NumberScheme: "",
						Status: "10",
						StatusTxt: "Draft",
						HSCodeStatus: "",
						DocumentStatus: "",
						DocumentStatusText: "",
						RelatedTransactionFlag: "",
						ModeOfTransport: "",
						ModeOfTransportTxt: "",
						TradeMode: "",
						TradeModeTxt: "",
						TradeTerm: "",
						PaymentTerm: "",
						DeclarationEntityType: "",
						DeclarationEntityTypeTxt: "",
						BgType: "",
						CAT: "",
						CATTxt: "",
						DomesticOrigin: "",
						KAD: "",
						KADTxt: "",
						TaxationType: "",
						Province: "",
						ShiptoLocationID: "",
						PackageType: "",
						PackageTypeTxt: "",
						TotalGrossWeight: "0",
						TotalNetWeight: "0",
						WeightUnit: "",
						TotalVolume: "0",
						TotalVolumeUnit: "",
						TotalPackages: 0,
						Approver: "",
						PTOChecker: "",
						PTOConfirm: "",
						DeclarationOperator: "",
						InsuranceFreightFlagConfig: "",
						SourceSystem: "",
						ETW: "",
						FulFillmentSource: "",
						UDR: "",
						InvoiceAmount: "0",
						InvoiceCurrency: "",
						HTMReferenceAmount: "0",
						HTMReferenceAmountCurrency: "",
						HTMReferenceFreight: "0",
						HTMReferenceFreightCurrency: "",
						HTMReferenceInsurance: "0",
						HTMReferenceInsuranceCurrency: "",
						FOBAmount: "0",
						FOBAmountCurrency: "",
						FreightAmount: "0",
						FreightAmountCurrency: "",
						InsuranceAmount: "0",
						InsuranceAmountCurrency: "",
						BOEAmount: "0",
						BOECurrency: "",
						ActualBOEAmount: "0",
						ActualBOECurrency: "",
						ExchangeRate: "0",
						CustomsNameID: "",
						CustomsName: "",
						ShipperID: "",
						Shipper: "",
						ConsigneeID: "",
						Consignee: "",
						LSPID: "",
						LSP: "",
						FTOGUID: null,
						FTOID: "",
						FTO: "",
						CompanyBpID: that._sCompanyBpId,
						CompanyID: "",
						Company: "",
						BrokerID: "",
						Broker: "",
						InvoiceNo: "",
						MFNo: "",
						PreDeclarationNo: "",
						PreDeclarationDate: null,
						PAARNo: "",
						BANO: "",
						ContractNo: "",
						PackingListNo: "",
						MAWB: "",
						HAWB: "",
						ExpressTrackingNo: "",
						CCRN: "",
						OrderReleaseNo: "",
						ManifestNo: "",
						TruckNumber: "",
						QuotationNo: "",
						QuotationNoCurrency: "",
						TransportTripNo: "",
						ContainerNo: "",
						VehicleNo: "",
						CreateDate: "",
						CreateTime: "",
						ChangeDate: "",
						ChangeTime: "",
						SubmitDate: "",
						SubmitTime: "",
						ImportDate: "",
						ImportTime: "",
						ExportDate: "",
						ExportTime: "",
						ShippingDate: "",
						ShippingTime: "",
						CalculationDate: "",
						CalculationTime: "",
						DeclarationDate: "",
						DeclarationTime: "",
						ClearanceStartDate: null,
						ClearanceAchieveDate: "",
						ClearanceAchieveTime: "",
						DepartureCountry: "",
						DepartureCountryTxt: "",
						DeparturePort: "",
						DeparturePortTxt: "",
						TransitCountry: "",
						TransitCountryTxt: "",
						TransitPort: "",
						TransitPortTxt: "",
						DestinationPort: "",
						DestinationPortTxt: "",
						DestinationCountry: "",
						DestinationCountryTxt: "",
						FinalDestination: "",
						FinalDestinationTxt: "",
						Remarks: "",
						ShipTo: "",
						ConsignmentNotes: ""
					}
				});

				that._sDeclarationId = sHeaderID;

				that.getView().setBindingContext(oContext);
				that.getView().bindElement(oContext.sPath);

				that._headerDocArray = [];
				that._headerBpArray = [];
				that._headerCostArray = [];
				that._headerItemArray = [];
				that._headerAttachArray = [];

				var hkCompanies = that.getHkCompanies().oData;
				var oCompanies = {};
				var oCompanyIds = {};
				var aHkCompanies = [];
				for (var i in hkCompanies) {
					var hkCompany = hkCompanies[i];
					aHkCompanies.push(hkCompany.CompanyBpID);
					oCompanyIds[hkCompany.CompanyBpID] = hkCompany.CompanyID;
				}

				var deferred = jQuery.Deferred();
				that.getModel().read("/Zcbs_C_BPSH", {
					filters: [
						new sap.ui.model.Filter("Role", "EQ", "SLLFTO")
					],
					success: function(oData) {
						var oContext = that.getView().getBindingContext();

						var oCompanySelect = that.byId("declarationCompanySelect");
						oCompanySelect.setBusy(true);
						oCompanySelect.removeAllItems();

						var bHK = false;
						for (var f in oData.results) {
							var result = oData.results[f];

							var sCompanyBpId = result.ParNumber;
							var sCompanyName = result.ParName;
							var sCompanyID = "";
							var sFtoGuid = result.Partner_Guid;

							if (that._sCompanyBpId === sCompanyBpId) {
								that._sCountry = result.Country;
								if (that._sCountry === "HK") {
									sCompanyID = oCompanyIds[sCompanyBpId];
									bHK = true;
								}

								oViewModel.setProperty("/Country", that._sCountry);

								that.getModel().setProperty(oContext.sPath + "/Country", that._sCountry);
								that.getModel().setProperty(oContext.sPath + "/Company", sCompanyName);
								that.getModel().setProperty(oContext.sPath + "/CompanyBpID", that._sCompanyBpId);
								that.getModel().setProperty(oContext.sPath + "/CompanyID", sCompanyID);
								that.getModel().setProperty(oContext.sPath + "/FTO", sCompanyName);
								that.getModel().setProperty(oContext.sPath + "/FTOID", that._sCompanyBpId);
								that.getModel().setProperty(oContext.sPath + "/FTOGUID", sFtoGuid);
							}
							if (aHkCompanies.indexOf(sCompanyBpId) > -1) {
								oCompanies[sCompanyBpId] = sCompanyName;
							}
						}

						if (bHK) {
							for (var k in oCompanies) {
								var kCompany = oCompanies[k];
								var oListItem = new sap.ui.core.ListItem({
									key : k,
									text : kCompany,
									additionalText : k
								});
								oCompanySelect.addItem(oListItem);
							}
							oCompanySelect.setSelectedKey(that._sCompanyBpId);
						} else {
							var oTemplate = new sap.ui.core.ListItem({
								key : "{ParNumber}",
								text : "{ParName}",
								additionalText : "{ParNumber}"
							});
							oCompanySelect.bindAggregation("items", {
								path: "/Zcbs_C_BPSH",
								filters: [
									new sap.ui.model.Filter("Role", "EQ", "SLLFTO", "")
								],
								template: oTemplate
							});
						}
						oCompanySelect.setBusy(false);

						if (that._sCountry === "HK" && that._sBusinessType === "20" && that._sImpExpIndicator === "1") {
							that.getModel().setProperty(oContext.sPath + "/WeightUnit", "KG");
							that.getModel().setProperty(oContext.sPath + "/PackageType", "10"); // Carton
						}

						if (that._sCountry === "HK" && that._sBusinessType === "20" && that._sImpExpIndicator === "2") {
							that.getModel().setProperty(oContext.sPath + "/DepartureCountry", "HK");
							that.getModel().setProperty(oContext.sPath + "/DepartureCountryTxt", "Hong Kong");
							that.getModel().setProperty(oContext.sPath + "/DestinationCountry", "CN");
							that.getModel().setProperty(oContext.sPath + "/DestinationCountryTxt", "China");
							that.getModel().setProperty(oContext.sPath + "/DestinationPort", "0000000447");
							that.getModel().setProperty(oContext.sPath + "/DestinationPortTxt", "皇岗海关");
						}

						that.getModel().callFunction("/GetConfigCurrency", {
							method: "POST",
							groupId: "GetConfigCurrency_" + new Date().getTime(),
							urlParameters: {
								Country: that._sCountry,
								ImportOrExport: that._sImpExpIndicator
							},
							success: function(oData) {
								that.getModel().setProperty(oContext.sPath + "/InvoiceCurrency", oData.Invoicecurrency);
								that.getModel().setProperty(oContext.sPath + "/BOECurrency", oData.Boecurrency);

							}
						});

						that._toggleButtonsAndView(true);

						deferred.resolve();
					},
					error: function() {
						deferred.reject();
					}
				});
				var promise = deferred.promise();

				jQuery.when(promise).done(function() {
					var oContext = that.getView().getBindingContext();

					that.getModel().read("/Zcbs_C_Config", {
						urlParameters: {
							$select: "Country,LegalReg,ImportExportIndicator,BusinessLine,InsuranceFreightFlag",
							$top: "1"
						},
						filters: [
							new sap.ui.model.Filter("Country", "EQ", that._sCountry),
							new sap.ui.model.Filter("ImportExportIndicator", "EQ", that._sImpExpIndicator),
							new sap.ui.model.Filter("BusinessLine", "EQ", that._sBusinessType)
						],
						success: function(oData) {
							if (oData.results.length <= 0) {
								if (that._sBusinessType === "10") {
									MessageBox.error("Cannot create declaration document, Insurance/Freight Flag hasn't been configured yet!", {
										actions: [ sap.m.MessageBox.Action.CLOSE ],
										styleClass: that.getOwnerComponent().getContentDensityClass(),
										onClose: function() {
											that._navToMaster();
										}
									});
								} else {
									that.getModel().setProperty(oContext.sPath + "/InsuranceFreightFlagConfig", "N");
									oViewModel.setProperty("/insuranceFreightFlag", false);
									oViewModel.setProperty("/busy", false);
								}
							} else {
								if (that._sCountry === "HK") {
									that.getModel().setProperty(oContext.sPath + "/InsuranceFreightFlagConfig", "N");
									oViewModel.setProperty("/insuranceFreightFlag", false);
									oViewModel.setProperty("/busy", false);
								} else {
									var sInsuranceFreightFlagConfig = oData.results[0].InsuranceFreightFlag;
									that.getModel().setProperty(oContext.sPath + "/InsuranceFreightFlagConfig", sInsuranceFreightFlagConfig);

									if (sInsuranceFreightFlagConfig === "Y") {
										oViewModel.setProperty("/insuranceFreightFlag", true);
									} else {
										oViewModel.setProperty("/insuranceFreightFlag", false);
									}
								}

								var sFTO = that.getModel().getProperty(oContext.sPath + "/FTOID");
								var sLegalRegulation = oData.results[0].LegalReg;
								var oDateFormat = DateFormat.getDateTimeInstance({
									pattern: "yyyy-MM-ddTHH:mm",
									UTC: true
								});
								var date = new Date();
								var sSystemDate = oDateFormat.format(date, true);
								var sParameters = escape("p_FTO='" + sFTO + "',p_Lgreg='" + sLegalRegulation + "',p_SystemDate=datetime'" + sSystemDate + "'");
								that.getModel().read("/Zcbs_C_Quotnvh(" + sParameters + ")/Set", {
									success: function(oData) {
										var items = oData.results;
										that.getView().setModel(new JSONModel({items: items}), "quotnvh");
										that.fields = [
												{label: "Quotation", key: "Quotation", searchable: false, width: "5rem", iskey: true, search: true},
												{label: "Supplier ID", key: "SupplierID", searchable: false, width: "10rem"},
												{label: "Supplier ID Text", key: "SupplierIDText", searchable: false, width: "15rem"},
												{label: "Supplier Site ID", key: "SupplierSiteID", searchable: false, width: "10rem"},
												{label: "Supplier Site ID Text", key: "SupplierSiteIDText", searchable: false, width: "15rem"},
												{label: "Cuhda", key: "Cuhda", searchable: false, width: "5rem"},
												{label: "Cuhda Text", key: "CuhdaText", searchable: false, width: "15rem"},
												{label: "Dest Port", key: "DestPort", searchable: false, width: "10rem"},
												{label: "Dest Location", key: "DestLocation", searchable: false, width: "10rem"},
												{label: "Buss Group", key: "BussGroup", searchable: false, width: "10rem"},
												{label: "Buss Group Text", key: "BussGroupText", searchable: false, width: "15rem"},
												{label: "From Date", key: "FromDate", searchable: false, width: "10rem"},
												{label: "To Date", key: "ToDate", searchable: false, width: "10rem"},
												{label: "Motra", key: "Motra", searchable: false, width: "5rem"},
												{label: "Motra Text", key: "MotraText", searchable: false, width: "15rem"},
												{label: "Currency", key: "Currency", searchable: false, width: "5rem"}
											];
										that._valuehelp = new QuotationValueHelper(that.getView().getModel("quotnvh"), that.byId("quotationNoInput"), that.fields, "Quotation");
									}
								});
							}

							oViewModel.setProperty("/busy", false);
						}
					});
				});
			});

			// Sets the text to the label
//			that.oUploadCollection.addEventDelegate({
//				onBeforeRendering: function() {
//					that.byId("attachmentTitle").setText(that.getAttachmentTitleText());
//				}
//			});

			// Flag to track if the upload of the new version was triggered by the Upload a new version button.
			that.bIsUploadVersion = false;
		},

		formatAttribute: function(sDate) {
			if (sDate) {
				var sDateFormat = DateFormat.getDateTimeInstance({
					pattern: "yyyy-MM-dd HH:mm:ss",
					UTC: true
				});
				return sDateFormat.format(sDate);
			}
			return sDate;
		},

		getAttachmentTitleText: function() {
			var aItems = that.oUploadCollection.getItems();
			return "Attachments (" + aItems.length + ")";
		},

		_onMetadataLoaded: function() {
			// Store original busy indicator delay for the detail view
			var iOriginalViewBusyDelay = that.getView().getBusyIndicatorDelay(),
				oViewModel = that.getModel("detailView"),
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

		/**
		 * Shows the selected item on the detail page
		 * On phones a additional history entry is created
		 * @param {sap.m.ObjectListItem} oItem selected Item
		 * @private
		 */
		_showItem: function(oItem) {
			// set the layout property of FCL control to show two columns
			that.getModel("appView").setProperty("/layout", "EndColumnFullScreen");
			that.getRouter().navTo("item", {
				BUSTYPE: that._sBusinessType,
				INDEI: that._sImpExpIndicator,
				detailId: that._sDeclarationId,
				itemId: oItem.getBindingContext().getObject().ItemID
			});
		},

		_saveDocument: function(sAction) {
			var oViewModel = that.getModel("detailView");
			var oViewContext = that.getView().getBindingContext();

			that.getModel().setProperty("Action", sAction, oViewContext);

			var oDeclaration = that.getView().getBindingContext().getObject();
			if (!oDeclaration.to_DETDOC) {
				oDeclaration.to_DETDOC = {};
			}
			if (!oDeclaration.to_DETBP) {
				oDeclaration.to_DETBP = {};
			}
			if (!oDeclaration.to_COST) {
				oDeclaration.to_COST = {};
			}
			if (!oDeclaration.to_DETI) {
				oDeclaration.to_DETI = {};
			}
			if (!oDeclaration.to_Attachment) {
				oDeclaration.to_Attachment = {};
			}

			var docArray = [];
			for (var i in that._headerDocArray) {
				var doc = that._headerDocArray[i];
				if (doc.LegdocID && doc.LegdocID.match(/^ffffffff-/)) {
					delete doc.LegdocID;
					delete doc.HeaderID;
					delete doc.__metadata;
				}
				docArray.push(doc);
			}
			var bpArray = [];
			for (var j in that._headerBpArray) {
				var bp = that._headerBpArray[j];
				if ((bp.ParID && bp.ParID.match(/^ffffffff-/)) || (bp.ParNumber && bp.ParNumber === "LSP_DUMMY1")
						|| (bp.ParNumber && bp.ParNumber === "CON_DUMMY1") || (bp.ParNumber && bp.ParNumber === "SIP_DUMMY1")) {
					delete bp.ParID;
					delete bp.HeaderID;
					delete bp.Role;
					delete bp.__metadata;
				}
				bpArray.push(bp);
			}

			// FIXME Offset issue for decimal fields
			oDeclaration.FreightAmount = oDeclaration.FreightAmount ? oDeclaration.FreightAmount.toString() : null;
			oDeclaration.InsuranceAmount = oDeclaration.InsuranceAmount ? oDeclaration.InsuranceAmount.toString() : null;
			oDeclaration.ExchangeRate = oDeclaration.ExchangeRate ? oDeclaration.ExchangeRate.toString() : null;
			oDeclaration.TotalGrossWeight = oDeclaration.TotalGrossWeight ? oDeclaration.TotalGrossWeight.toString() : null;
			oDeclaration.TotalNetWeight = oDeclaration.TotalNetWeight ? oDeclaration.TotalNetWeight.toString() : null;
			oDeclaration.TotalVolume = oDeclaration.TotalVolume ? oDeclaration.TotalVolume.toString() : null;
			// oDeclaration.TotalPackages = oDeclaration.TotalPackages ? oDeclaration.TotalPackages.toString() : null;

			oDeclaration.to_DETDOC = { results: docArray };
			oDeclaration.to_DETBP = { results: bpArray };
			oDeclaration.to_COST.results = that._headerCostArray;
			oDeclaration.to_DETI.results = that._headerItemArray;
			oDeclaration.to_Attachment.results = that._headerAttachArray;

			delete oDeclaration.to_DETDOC.__list;
			delete oDeclaration.to_DETBP.__list;
			delete oDeclaration.to_COST.__list;
			delete oDeclaration.to_DETI.__list;
			delete oDeclaration.to_Attachment.__list;
			delete oDeclaration.to_DETIGROUPING;

			delete oDeclaration.HeaderID;
			delete oDeclaration.__metadata;

			var fDateFormat = DateFormat.getDateTimeInstance({
				pattern: "yyyyMMdd",
				UTC: true
			});
			var oImportDate = oViewModel.getProperty("/ImportDate");
			oDeclaration.ImportDate = oImportDate ? fDateFormat.format(oImportDate) : null;
			var oDepartureDate = oViewModel.getProperty("/ExportDate");
			oDeclaration.ExportDate = oDepartureDate ? fDateFormat.format(oDepartureDate) : null;
			var oActualShipmentDate = oViewModel.getProperty("/ShippingDate");
			oDeclaration.ShippingDate = oActualShipmentDate ? fDateFormat.format(oActualShipmentDate) : null;

			console.log(oDeclaration);

			that.getModel().create("/ZCBS_C_DETH", oDeclaration, {
				success: function(oData, response) {
					// response header
					var hdrMessage = response.headers["sap-message"];
					var bSuccess = true;
					if (hdrMessage) {
						var hdrMessageObject = JSON.parse(hdrMessage);
						if (hdrMessageObject && hdrMessageObject.severity === "error") {
							bSuccess = false;
							MessageBox.error(hdrMessageObject.message, {
								styleClass: that.getOwnerComponent().getContentDensityClass()
							});
						} else if (hdrMessageObject && hdrMessageObject.severity === "warning") {
							MessageBox.warning(hdrMessageObject.message, {
								styleClass: that.getOwnerComponent().getContentDensityClass()
							});
						} else {
							// success or info
						}
					}

					if (bSuccess) {
//						that._documentsList.removeAllRows();
//						that._partnersList.removeAllRows();
//						that._taxCostsList.removeAllRows();
//						that._feeCostsList.removeAllRows();
//						that.oLineItemTable.removeAllRows();

						MessageBox.information(that.getResourceBundle().getText("success" + sAction + "Task"), {
							styleClass: that.getOwnerComponent().getContentDensityClass()
						});
						that.getModel("appView").setProperty("/uiState/layout", "OneColumn");
						that._toggleButtonsAndView(false);
						that.getRouter().navTo("master", {
							BUSTYPE: that._sBusinessType,
							INDEI: that._sImpExpIndicator
						});
					}
					oViewModel.setProperty("/busy", false);
				}
			});
		},

		_toggleButtonsAndView: function(bEdit) {
			var aControls = [
				{ control: that.byId("declarationCompanySelect") },
				{ control: that.byId("modeOfTransportSelect") },
				{ control: that.byId("tradeTermSelect") },
				{ control: that.byId("departureCountrySelect") },
				{ control: that.byId("exchangeRateInput") },
				{ control: that.byId("freightAmountInput") },
				{ control: that.byId("insuranceAmountInput") },
				{ control: that.byId("totalGrossWeightInput") },
				{ control: that.byId("totalNetWeightInput") },
				{ control: that.byId("totalVolumeInput") },
				{ control: that.byId("invoiceCurrencyInput") },
				{ control: that.byId("BOECurrencyInput") }
			];

			var oViewModel = that.getModel("detailView");
			var sBusinessType = oViewModel.getProperty("/BusinessType");
			var sImportOrExport = oViewModel.getProperty("/ImportOrExport");
			var sCountry = oViewModel.getProperty("/Country");
			if (sImportOrExport === "1") {
				aControls.push({ control: that.byId("importDatePicker") });
			}
			if (sImportOrExport === "2") {
				aControls.push({ control: that.byId("departureDatePicker") });
			}
			if (sCountry === "HK" && sBusinessType === "20" && sImportOrExport === "1") {
				aControls.push({ control: that.byId("departurePortSelect") });
				aControls.push({ control: that.byId("mawbInput") });
				aControls.push({ control: that.byId("hawbInput") });
			}

			if (bEdit) {
				jQuery.each(aControls, function(i, oObject) {
					that.registerToMessageManager(oObject);
				});

				var aSelects = [
					{ control: that.byId("fulFillmentSourceSelect") },
					{ control: that.byId("declarationEntityTypeSelect") },
					{ control: that.byId("declarationCompanySelect") },
					{ control: that.byId("tradeModeSelect") },
					{ control: that.byId("bgTypeSelect") },
					{ control: that.byId("modeOfTransportSelect") },
					{ control: that.byId("tradeTermSelect") },
					{ control: that.byId("catSelect") },
					{ control: that.byId("kadSelect") },
					{ control: that.byId("packageTypeSelect") }
				];

				jQuery.each(aSelects, function(i, oObject) {
					that.addSelectClearButton(oObject);
				});

				that._setTransitPortReadonly();
				that._setDestinationPortReadonly();
				that._setFinalDestinationReadonly();
			} else {
				jQuery.each(aControls, function(i, oObject) {
					that.unregisterToMessageManager(oObject);
				});
			}
		},

		_setDeparturePortReadonly: function(bReadonly) {
			if (bReadonly) {
				function waitForInner(time) {
					var oInner = jQuery(".departure input.sapMInputBaseInner");
					if (oInner.length > 0) {
						oInner.attr("readonly", "readonly");
						oInner.attr("aria-readonly", "true");
						jQuery(".departure div.sapMInputDivWrapper").addClass("sapMInputBaseReadonlyInner");
						return;
					} else {
						setTimeout(function() {
							waitForInner(time);
						}, time);
					}
				}
				waitForInner(500);
			} else {
				function waitForInner(time) {
					var oInner = jQuery(".departure input.sapMInputBaseInner");
					if (oInner.length > 0) {
						oInner.removeAttr("readonly");
						oInner.removeAttr("aria-readonly");
						jQuery(".departure div.sapMInputDivWrapper").removeClass("sapMInputBaseReadonlyInner");
						return;
					} else {
						setTimeout(function() {
							waitForInner(time);
						}, time);
					}
				}
				waitForInner(500);
			}
		},

		_setTransitPortReadonly: function() {
			var oTransitPortInput = that.byId("transitPortTxtInput");
			oTransitPortInput.onAfterRendering = function() {
				if (sap.m.Input.prototype.onAfterRendering) {
					sap.m.Input.prototype.onAfterRendering.apply(this);
				}
				var oInner = jQuery(".transit input.sapMInputBaseInner");
				oInner.attr("readonly", "readonly");
				oInner.attr("aria-readonly", "true");
				jQuery(".transit div.sapMInputDivWrapper").addClass("sapMInputBaseReadonlyInner");
			};
		},

		_setDestinationPortReadonly: function() {
			var oDestinationPortInput = that.byId("destinationPortTxtInput");
			oDestinationPortInput.onAfterRendering = function() {
				if (sap.m.Input.prototype.onAfterRendering) {
					sap.m.Input.prototype.onAfterRendering.apply(this);
				}
				var oInner = jQuery(".destination input.sapMInputBaseInner");
				oInner.attr("readonly", "readonly");
				oInner.attr("aria-readonly", "true");
				jQuery(".destination div.sapMInputDivWrapper").addClass("sapMInputBaseReadonlyInner");
			};
		},

		_setFinalDestinationReadonly: function() {
			var oFinalDestinationInput = that.byId("finalDestinationTxtInput");
			oFinalDestinationInput.onAfterRendering = function() {
				if (sap.m.Input.prototype.onAfterRendering) {
					sap.m.Input.prototype.onAfterRendering.apply(this);
				}
				var oInner = jQuery(".final input.sapMInputBaseInner");
				oInner.attr("readonly", "readonly");
				oInner.attr("aria-readonly", "true");
				jQuery(".final div.sapMInputDivWrapper").addClass("sapMInputBaseReadonlyInner");
			};
		},

		/**
		 * Set the full screen mode to false and navigate to master page
		 */
		onCloseDetailPress: function() {
			MessageBox.confirm(that.getResourceBundle().getText("confirmToDiscard"), {
				styleClass: that.getOwnerComponent().getContentDensityClass(),
				actions: [MessageBox.Action.YES, MessageBox.Action.NO],
				onClose: function(oAction) {
					if (oAction === MessageBox.Action.YES) {
						that._navToMaster();
					}
				}
			});
		},

		_navToMaster: function() {
			sap.ui.getCore().getMessageManager().removeAllMessages();
			that.getModel("appView").setProperty("/uiState/layout", "OneColumn");
			that.getModel("detailView").setProperty("/editable", false);
			that.getModel("detailView").refresh(true);
			that._toggleButtonsAndView(false);
			that.getRouter().navTo("master", {
				BUSTYPE: that._sBusinessType,
				INDEI: that._sImpExpIndicator
			});
		}
	});

	return detailController;
});
