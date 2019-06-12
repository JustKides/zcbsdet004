/*global location */
sap.ui.define([
	"huawei/cbs/det004/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/unified/Currency",
	"sap/ui/export/Spreadsheet",
	"sap/ui/Device",
	"sap/ui/core/CustomData",
	"sap/ui/core/format/DateFormat",
	"sap/ui/table/Column",
	"sap/ui/table/RowAction",
	"sap/ui/table/RowActionItem",
	"sap/ui/table/SortOrder",
	"sap/ui/model/Sorter",
	"huawei/cbs/det004/model/formatter",
	"sap/m/MessagePopover",
	"sap/m/MessagePopoverItem",
	"sap/m/MessageBox",
	"sap/m/Text",
	"sap/m/Link",
	"sap/m/ObjectNumber"
], function(
	BaseController,
	JSONModel,
	Currency,
	Spreadsheet,
	Device,
	CustomData,
	DateFormat,
	Column,
	RowAction,
	RowActionItem,
	SortOrder,
	Sorter,
	formatter,
	MessagePopover,
	MessagePopoverItem,
	MessageBox,
	Text,
	Link,
	ObjectNumber
) {
	"use strict";

	var that;

	var masterController = BaseController.extend("huawei.cbs.det004.controller.Master", {
		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function() {
			that = this;

			// Model used to manipulate control states. The chosen values make sure,
			// master page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var oViewModel = new JSONModel({
				busy: false,
				delay: 0,
				count: {
					all: 0,
					draft: 0,
					block: 0,
					submitted: 0,
					approved: 0,
					declared: 0,
					toBeAccepted: 0,
					partiallyAccepted: 0,
					accepted: 0
				},
				importOrExport: "",
				businessType: "",
				selectedTab: "all",
				selectedCountry: "",
				selectedTransMode: "",
				declarationSelected: false,
				HKOnly: false,
				NotHK: false,
				RawMaterial: false,
				TotalAmount: "0",
				TotalPackages: "0",
				TotalNetWeight: "0",
				lineItemListTitle: that.getResourceBundle().getText("masterLineItemTableHeading")
			});
			oViewModel.setDefaultBindingMode(sap.ui.model.BindingMode.TwoWay);
			that.setModel(oViewModel, "masterView");

			that._viewPrefix = "huawei.cbs.det004.view.";
			that._fragmentPrefix = "huawei.cbs.det004.fragment.";

			that._selectFtoDialog = sap.ui.xmlfragment(that.getView().getId(), that._fragmentPrefix + "SelectFtoDialog", this);
			that.getView().addDependent(that._selectFtoDialog);

			that._packingListNoDialog = sap.ui.xmlfragment(that.getView().getId(), that._fragmentPrefix + "PackingListNoDialog", this);
			that.getView().addDependent(that._packingListNoDialog);

			that.aHeaderID = [];
			that.aDocumentNo = [];
			that.aHSCodeStatus = [];

			// Initial filter
			that._mFilters = {
				"10": new sap.ui.model.Filter([
					new sap.ui.model.Filter("Status", "EQ", "00"),
					new sap.ui.model.Filter("Status", "EQ", "10")
				], false), // Initial & Draft
				"30": new sap.ui.model.Filter("Status", "EQ", "30"), // Submitted
				"40": new sap.ui.model.Filter("Status", "EQ", "40"), // Approved
				"50": new sap.ui.model.Filter("Status", "EQ", "50"), // Declared
				"60": new sap.ui.model.Filter("Status", "EQ", "60"), // To Be Accepted
				"65": new sap.ui.model.Filter("Status", "EQ", "65"), // Partially Accepted
				"70": new sap.ui.model.Filter("Status", "EQ", "70")  // Accepted
			};

			that.getRouter().getRoute("master").attachPatternMatched(that._onMasterMatched, this);
			that.getRouter().getRoute("detail").attachPatternMatched(that._onMasterMatched, this);
			that.getRouter().getRoute("detailCreate").attachPatternMatched(that._onMasterMatched, this);
			that.getRouter().getRoute("item").attachPatternMatched(that._onMasterMatched, this);
			that.getOwnerComponent().getModel().metadataLoaded().then(that._onMetadataLoaded.bind(this));

			// Add clear button to ActionSelect
			that.getView().addEventDelegate({
				onBeforeFirstShow: function() {
					var aSelects = [
						{ control: that.byId("countrySelect"), callback: function() {
							oViewModel.setProperty("/HKOnly", false);
							oViewModel.setProperty("/NotHK", false);
						} },
						{ control: that.byId("modeOfTransportSelect") },
						{ control: that.byId("hsCodeStatusSelect") },
						{ control: that.byId("sourceSystemSelect") },
						{ control: that.byId("etwSelect") }
					];

					jQuery.each(aSelects, function(i, oObject) {
						that.addSelectClearButton(oObject);
					});
				}
			});
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		onListSelectionChange: function(oEvent) {
			var bSelectAll = oEvent.getParameter("selectAll");
			var iRowIndex = oEvent.getParameter("rowIndex");
			var oViewModel = that.getModel("masterView");
			var oTable = that.byId("declarationTable");

			that.byId("summaryText").setBusyIndicatorDelay(0);
			that.byId("summaryText").setBusy(true);
			oTable.setBusyIndicatorDelay(0);
			oTable.setBusy(true);

			var deferred = jQuery.Deferred();
			if (bSelectAll) { // Select all
				that.aHeaderID = [];
				that.aDocumentNo = [];
				that.aHSCodeStatus = [];
				that.getModel().read("/ZCBS_C_DETH", {
					filters: [ that.aFilter ],
					urlParameters: {
						$select: "HeaderIDString,DocumentNo,HSCodeStatus",
						$top: 99999999
					},
					success: function (oData) {
						for (var i in oData.results) {
							var result = oData.results[i];
							if (result && result.HeaderIDString) {
								that.aHeaderID.push(result.HeaderIDString);
								that.aDocumentNo.push(result.DocumentNo);
								that.aHSCodeStatus.push(result.HSCodeStatus);
							}
						}
						deferred.resolve();
					}
				});
			} else {
				if (iRowIndex === -1) { // Un-select all
					that.aHeaderID = [];
					that.aDocumentNo = [];
					that.aHSCodeStatus = [];
				} else {
					var aIndices = oEvent.getParameter("rowIndices");
					for (var i = 0; i < aIndices.length; i++) {
						var bSelected = oTable.isIndexSelected(aIndices[i]);
						var oContext = oTable.getContextByIndex(aIndices[i]);

						if (oContext) {
							var sHeaderIDString = oContext.getProperty("HeaderIDString");
							var sDocumentNo = oContext.getProperty("DocumentNo");
							var sHSCodeStatus = oContext.getProperty("HSCodeStatus");

							if (bSelected) {
								that.aHeaderID.push(sHeaderIDString);
								that.aDocumentNo.push(sDocumentNo);
								that.aHSCodeStatus.push(sHSCodeStatus);
							} else {
								var xIndex = that.aHeaderID.indexOf(sHeaderIDString);
								if (xIndex !== -1) {
									that.aHeaderID.splice(xIndex, 1);
								}
								var yIndex = that.aDocumentNo.indexOf(sDocumentNo);
								if (yIndex !== -1) {
									that.aDocumentNo.splice(yIndex, 1);
								}
								var zIndex = that.aHSCodeStatus.indexOf(sHSCodeStatus);
								if (zIndex !== -1) {
									that.aHSCodeStatus.splice(zIndex, 1);
								}
							}
						}
					}
				}
				deferred.resolve();
			}
			var promise = deferred.promise();

			jQuery.when(promise).done(function() {
				if (that.aHeaderID.length <= 0) {
					oViewModel.setProperty("/declarationSelected", false);
					that.byId("summaryText").setBusy(false);
					oTable.setBusy(false);
				} else {
					oViewModel.setProperty("/declarationSelected", true);
					var sHeaderIDs = that.aHeaderID.join(",");
					that.getModel().callFunction("/CalculateSummary", {
						method: "POST",
						groupId: "CalculateSummary_" + new Date().getTime(),
						urlParameters: {
							HeaderID: sHeaderIDs
						},
						success: function(oData) {
							oViewModel.setProperty("/TotalAmount", oData.InvoiceAmount);
							oViewModel.setProperty("/TotalPackages", oData.TotalPackages);
							oViewModel.setProperty("/TotalNetWeight", Number(oData.TotalNetWeight).toString());
							that.byId("summaryText").setBusy(false);
							oTable.setBusy(false);
						},
						error: function() {
							that.byId("summaryText").setBusy(false);
							oTable.setBusy(false);
						}
					});
				}
			});
		},

		sortDeclarationTasks: function(oEvent) {
			that.oCurrentColumn = oEvent.getParameter("column");
			that.sOrder = oEvent.getParameter("sortOrder");

			that.oCurrentColumn.setSorted(true);
			that.oCurrentColumn.setSortOrder(that.sOrder);

			that.oSorter = new Sorter(that.oCurrentColumn.getSortProperty(), that.sOrder === SortOrder.Descending);
		},

		onListItemPress: function(oEvent) {
			var oTable = that.byId("declarationTable");
			that.getModel("appView").setProperty("/firstVisibleRow", oTable.getFirstVisibleRow());
			that.getModel("appView").setProperty("/selectedIndex", oTable.indexOfRow(oEvent.getSource().getParent()));
			that._showDetail(oEvent.getSource());
		},

		onPackingListNoLinkPress: function(oEvent) {
			var oItem = oEvent.getSource();
			that.byId("packingListNoList").bindAggregation("items", {
				path: "/Zcbs_C_PackingList",
				filters: new sap.ui.model.Filter("HeaderID", sap.ui.model.FilterOperator.EQ, oItem.getBindingContext().getObject().HeaderID),
				template: new sap.m.StandardListItem({
					title: "{PackingListNo}",
					iconDensityAware: false,
					iconInset: false
				})
			});
			that._packingListNoDialog.open();
		},

		onPackingListNoSearch: function(oEvent) {
			var oList = that.byId("packingListNoList");
			var sValue = oEvent.getParameter("query");
			var oFilter = new sap.ui.model.Filter("PackingListNo", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oList.getBinding("items");
			oBinding.filter([oFilter]);
		},

		onPackingListNoClose: function(oEvent) {
			that.byId("packingListNoSearchField").setValue("");
			that._packingListNoDialog.close();
		},

		onTabSelect: function() {
			that.byId("declarationTable").clearSelection();
			that.getModel("masterView").setProperty("/declarationSelected", false);
			that.onSearch();
		},

		onCountryChange: function() {
			var sCountry = "";
			var oCountrySelectedItem = that.byId("countrySelect").getSelectedItem();
			if (oCountrySelectedItem) {
				sCountry = oCountrySelectedItem.getBindingContext().getObject().CountryKey;
			}
			var sBusinessType = that._sBusinessType;
			var sImportOrExport = that._sImpExpIndicator;
			var oViewModel = that.getModel("masterView");
			var sKey = oViewModel.getProperty("/selectedTab");

			var oTable = that.byId("declarationTable");

			oTable.removeAllColumns();
			oTable.destroyColumns();

			var sSortProperty = null;
			var oOrder = null;
			if (that.oCurrentColumn) {
				sSortProperty = that.oCurrentColumn.getSortProperty();
				oOrder = that.sOrder;
			} else {
				sSortProperty = "DocumentNo";
				oOrder = SortOrder.Descending;
			}

			oTable.addColumn(new Column({
				hAlign: "Begin",
				width: "10rem",
				sorted: (sSortProperty === "DocumentNo"),
				sortOrder: oOrder,
				sortProperty: "DocumentNo"
			}).addCustomData(new CustomData({
				key: "p13nData",
				value: '\{"columnKey":"DocumentNo","leadingProperty":"DocumentNo","filterProperty":"DocumentNo","sortProperty":"DocumentNo"}'
			})).setLabel(new Text({
				text: "{/#ZCBS_C_DETHType/DocumentNo/@sap:label}"
			})).setTemplate(new Link({
				text: "{DocumentNo}",
				emphasized: true,
				press: that.onListItemPress
			})));

			if (sCountry !== "HK" || (sBusinessType === "20" && sImportOrExport === "2")) {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "10rem",
					sorted: (sSortProperty === "BANO"),
					sortOrder: oOrder,
					sortProperty: "BANO"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"BANO","leadingProperty":"BANO","filterProperty":"BANO","sortProperty":"BANO"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/BANO/@sap:label}"
				})).setTemplate(new Text({
					text: "{BANO}"
				})));
			}

			if (sCountry !== "HK" || (sBusinessType === "20" && sImportOrExport === "2") || (sBusinessType === "10" && sImportOrExport === "1")) {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "10rem",
					sorted: (sSortProperty === "ManifestNo"),
					sortOrder: oOrder,
					sortProperty: "ManifestNo"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"ManifestNo","leadingProperty":"ManifestNo","filterProperty":"ManifestNo","sortProperty":"ManifestNo"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/ManifestNo/@sap:label}"
				})).setTemplate(new Text({
					text: "{ManifestNo}"
				})));
			}

			if (!(sCountry === "HK" && sBusinessType === "10" && sImportOrExport === "1")) {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "10rem",
					sorted: (sSortProperty === "HAWB"),
					sortOrder: oOrder,
					sortProperty: "HAWB"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"HAWB","leadingProperty":"HAWB","filterProperty":"HAWB","sortProperty":"HAWB"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/HAWB/@sap:label}"
				})).setTemplate(new Text({
					text: "{HAWB}"
				})));
			}

			if (sCountry === "HK" && sBusinessType === "20") {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "10rem",
					sorted: (sSortProperty === "MAWB"),
					sortOrder: oOrder,
					sortProperty: "MAWB"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"MAWB","leadingProperty":"MAWB","filterProperty":"MAWB","sortProperty":"MAWB"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/MAWB/@sap:label}"
				})).setTemplate(new Text({
					text: "{MAWB}"
				})));
			}

			oTable.addColumn(new Column({
				hAlign: "Begin",
				width: "15rem",
				sorted: (sSortProperty === "Company"),
				sortOrder: oOrder,
				sortProperty: "Company"
			}).addCustomData(new CustomData({
				key: "p13nData",
				value: '\{"columnKey":"Company","leadingProperty":"Company","filterProperty":"Company","sortProperty":"Company"}'
			})).setLabel(new Text({
				text: "{/#ZCBS_C_DETHType/Company/@sap:label}"
			})).setTemplate(new Text({
				text: "{Company}"
			})));

			oTable.addColumn(new Column({
				hAlign: "Begin",
				width: "15rem",
				sorted: (sSortProperty === "Shipper"),
				sortOrder: oOrder,
				sortProperty: "Shipper"
			}).addCustomData(new CustomData({
				key: "p13nData",
				value: '\{"columnKey":"Shipper","leadingProperty":"Shipper","filterProperty":"Shipper","sortProperty":"Shipper"}'
			})).setLabel(new Text({
				text: "{/#ZCBS_C_DETHType/Shipper/@sap:label}"
			})).setTemplate(new Text({
				text: "{Shipper}"
			})));

			if (!(sCountry === "HK" && sBusinessType === "10" && sImportOrExport === "2")) {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "15rem",
					sorted: (sSortProperty === "Consignee"),
					sortOrder: oOrder,
					sortProperty: "Consignee"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"Consignee","leadingProperty":"Consignee","filterProperty":"Consignee","sortProperty":"Consignee"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/Consignee/@sap:label}"
				})).setTemplate(new Text({
					text: "{Consignee}"
				})));
			}

			if (!(sCountry === "HK" && sBusinessType === "20" && sImportOrExport === "1")) {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "10rem",
					sorted: (sSortProperty === "DestinationCountryTxt"),
					sortOrder: oOrder,
					sortProperty: "DestinationCountryTxt"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"DestinationCountry","additionalProperty":"DestinationCountryTxt","leadingProperty":"DestinationCountry","filterProperty":"DestinationCountry","sortProperty":"DestinationCountry"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/DestinationCountry/@sap:label}"
				})).setTemplate(new Text({
					text: "{DestinationCountryTxt}"
				})));
			}

			if (sCountry === "HK" && (sBusinessType === "20" || (sBusinessType === "10" && sImportOrExport === "1"))) {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "10rem",
					sorted: (sSortProperty === "TruckNumber"),
					sortOrder: oOrder,
					sortProperty: "TruckNumber"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"TruckNumber","leadingProperty":"TruckNumber","filterProperty":"TruckNumber","sortProperty":"TruckNumber"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/TruckNumber/@sap:label}"
				})).setTemplate(new Text({
					text: "{TruckNumber}"
				})));
			}

			if (sCountry === "HK" && sBusinessType === "20") {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "10rem",
					sorted: (sSortProperty === "TransportTripNo"),
					sortOrder: oOrder,
					sortProperty: "TransportTripNo"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"TransportTripNo","leadingProperty":"TransportTripNo","filterProperty":"TransportTripNo","sortProperty":"TransportTripNo"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/TransportTripNo/@sap:label}"
				})).setTemplate(new Text({
					text: "{TransportTripNo}"
				})));
			}

			if (sCountry === "HK" && (sBusinessType === "20" || (sBusinessType === "10" && sImportOrExport === "1"))) {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "10rem",
					sorted: (sSortProperty === "VehicleNo"),
					sortOrder: oOrder,
					sortProperty: "VehicleNo"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"VehicleNo","leadingProperty":"VehicleNo","filterProperty":"VehicleNo","sortProperty":"VehicleNo"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/VehicleNo/@sap:label}"
				})).setTemplate(new Text({
					text: "{VehicleNo}"
				})));
			}

			if (sCountry === "HK" && sBusinessType === "20") {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "10rem",
					sorted: (sSortProperty === "ExpressTrackingNo"),
					sortOrder: oOrder,
					sortProperty: "ExpressTrackingNo"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"ExpressTrackingNo","leadingProperty":"ExpressTrackingNo","filterProperty":"ExpressTrackingNo","sortProperty":"ExpressTrackingNo"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/ExpressTrackingNo/@sap:label}"
				})).setTemplate(new Text({
					text: "{ExpressTrackingNo}"
				})));
			}

			if (sCountry === "HK" && (sBusinessType === "20" || (sBusinessType === "10" && sImportOrExport === "1"))) {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "7rem",
					sorted: (sSortProperty === "TotalPackages"),
					sortOrder: oOrder,
					sortProperty: "TotalPackages"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"TotalPackages","leadingProperty":"TotalPackages","filterProperty":"TotalPackages","sortProperty":"TotalPackages"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/TotalPackages/@sap:label}"
				})).setTemplate(new Text({
					text: "{TotalPackages}"
				})));
			}

			if (sCountry === "HK" && (sBusinessType === "10" && sImportOrExport === "1")) {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "7rem",
					sorted: (sSortProperty === "InvoiceAmount"),
					sortOrder: oOrder,
					sortProperty: "InvoiceAmount"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"InvoiceAmount","additionalProperty":"InvoiceCurrency","leadingProperty":"InvoiceAmount","filterProperty":"InvoiceAmount","sortProperty":"InvoiceAmount"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/InvoiceAmount/@sap:label}"
				})).setTemplate(new ObjectNumber({
					number: "{parts: [{path: 'InvoiceAmount'},{path: 'InvoiceCurrency'}],type: 'sap.ui.model.type.Currency',formatOptions: {showMeasure: false}}"
				})));
			}

			if (sCountry === "HK" && sBusinessType === "20") {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "7rem",
					sorted: (sSortProperty === "BOEAmount"),
					sortOrder: oOrder,
					sortProperty: "BOEAmount"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"BOEAmount","leadingProperty":"BOEAmount","additionalProperty":"BOECurrency","filterProperty":"BOEAmount","sortProperty":"BOEAmount"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/BOEAmount/@sap:label}"
				})).setTemplate(new ObjectNumber({
					number: "{parts: [{path: 'BOEAmount'},{path: 'BOECurrency'}],type: 'sap.ui.model.type.Currency',formatOptions: {showMeasure: false}}"
				})));
			}

			if (!(sCountry === "HK" && sBusinessType === "10" && sImportOrExport === "2")) {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "15rem",
					sorted: (sSortProperty === "LSP"),
					sortOrder: oOrder,
					sortProperty: "LSP"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"LSP","leadingProperty":"LSP","filterProperty":"LSP","sortProperty":"LSP"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/LSP/@sap:label}"
				})).setTemplate(new Text({
					text: "{LSP}"
				})));
			}

			if (sCountry === "HK" && sBusinessType === "20") {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "10rem",
					sorted: (sSortProperty === "CreatedByUser"),
					sortOrder: oOrder,
					sortProperty: "CreatedByUser"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"CreatedByUser","leadingProperty":"CreatedByUser","filterProperty":"CreatedByUser","sortProperty":"CreatedByUser"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/CreatedByUser/@sap:label}"
				})).setTemplate(new Text({
					text: "{CreatedByUser}"
				})));
			}

			if (!(sCountry === "HK" && sBusinessType === "20")) {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "10rem"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"PackingListNo","leadingProperty":"PackingListNo","filterProperty":"PackingListNo","sortProperty":"PackingListNo"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/PackingListNo/@sap:label}"
				})).setTemplate(new Link({
					text: "Packing List No.",
					emphasized: true,
					press: that.onPackingListNoLinkPress
				})));
			}

			oTable.addColumn(new Column({
				hAlign: "Begin",
				width: "7rem",
				sorted: (sSortProperty === "CreateDate"),
				sortOrder: oOrder,
				sortProperty: "CreateDate"
			}).addCustomData(new CustomData({
				key: "p13nData",
				value: '\{"columnKey":"CreateDate","additionalProperty":"CreateTime","leadingProperty":"CreateDate","filterProperty":"CreateDate","sortProperty":"CreateDate"}'
			})).setLabel(new Text({
				text: "{/#ZCBS_C_DETHType/CreateDate/@sap:label}"
			})).setTemplate(
				new Text().bindProperty("text", {
					parts: [
						{ path: "CreateDate" }
					],
					type: 'sap.ui.model.type.Date',
					formatter: formatter.dateTimeFormatter
				})
			));

			if (sCountry === "HK" && sImportOrExport === "1") {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "7rem",
					sorted: (sSortProperty === "ImportDate"),
					sortOrder: oOrder,
					sortProperty: "ImportDate"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"ImportDate","leadingProperty":"ImportDate","filterProperty":"ImportDate","sortProperty":"ImportDate"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/ImportDate/@sap:label}"
				})).setTemplate(
					new Text().bindProperty("text", {
						parts: [
							{ path: "ImportDate" }
						],
						type: 'sap.ui.model.type.Date',
						formatter: formatter.dateTimeFormatter
					})
				));
			}

			if (sCountry === "HK" && sImportOrExport === "2") {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "7rem",
					sorted: (sSortProperty === "ExportDate"),
					sortOrder: oOrder,
					sortProperty: "ExportDate"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"ExportDate","leadingProperty":"ExportDate","filterProperty":"ExportDate","sortProperty":"ExportDate"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/ExportDate/@sap:label}"
				})).setTemplate(
					new Text().bindProperty("text", {
						parts: [
							{ path: "ExportDate" }
						],
						type: 'sap.ui.model.type.Date',
						formatter: formatter.dateTimeFormatter
					})
				));
			}

			if (sCountry !== "HK" || (sBusinessType === "10" && sImportOrExport === "2")) {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "7rem",
					sorted: (sSortProperty === "ShippingDate"),
					sortOrder: oOrder,
					sortProperty: "ShippingDate"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"ShippingDate","leadingProperty":"ShippingDate","filterProperty":"ShippingDate","sortProperty":"ShippingDate"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/ShippingDate/@sap:label}"
				})).setTemplate(
					new Text().bindProperty("text", {
						parts: [
							{ path: "ShippingDate" }
						],
						type: 'sap.ui.model.type.Date',
						formatter: formatter.dateTimeFormatter
					})
				));
			}

			if (!(sCountry === "HK" && sBusinessType === "20" && sImportOrExport === "1")) {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "15rem",
					sorted: (sSortProperty === "ModeOfTransportTxt"),
					sortOrder: oOrder,
					sortProperty: "ModeOfTransportTxt"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"ModeOfTransport","additionalProperty":"ModeOfTransportTxt","leadingProperty":"ModeOfTransport","filterProperty":"ModeOfTransport","sortProperty":"ModeOfTransport"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/ModeOfTransport/@sap:label}"
				})).setTemplate(new Text({
					text: "{ModeOfTransportTxt}"
				})));
			}

			if (sCountry === "HK" && sBusinessType === "10") {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "5rem",
					sorted: (sSortProperty === "SourceSystem"),
					sortOrder: oOrder,
					sortProperty: "SourceSystem"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"SourceSystem","leadingProperty":"SourceSystem","filterProperty":"SourceSystem","sortProperty":"SourceSystem"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/SourceSystem/@sap:label}"
				})).setTemplate(new Text({
					text: "{SourceSystem}"
				})));
			}

			if (sKey === "10") {
				oTable.addColumn(new Column({
					hAlign: "Begin",
					width: "5rem",
					sorted: (sSortProperty === "HSCodeStatus"),
					sortOrder: oOrder,
					sortProperty: "HSCodeStatus"
				}).addCustomData(new CustomData({
					key: "p13nData",
					value: '\{"columnKey":"HSCodeStatus","leadingProperty":"HSCodeStatus","filterProperty":"HSCodeStatus","sortProperty":"HSCodeStatus"}'
				})).setLabel(new Text({
					text: "{/#ZCBS_C_DETHType/HSCodeStatus/@sap:label}"
				})).setTemplate(new Text({
					text: "{HSCodeStatus}"
				})));
			}

			oTable.addColumn(new Column({
				hAlign: "Begin",
				width: "auto"
			}).addCustomData(new CustomData({
				key: "p13nData",
				value: '\{"columnKey":"HeaderID","leadingProperty":"HeaderID","additionalProperty":"ShippingDate,BANO,BOEAmount,BOECurrency,CAT,CCRN,VehicleNo,Company,Consignee,CreatedByUser,CreateDate,DestinationCountry,DestinationCountryTxt,DocumentNo,DocumentYear,ExpressTrackingNo,HAWB,HeaderID,ExportDate,ImportDate,HSCodeStatus,InvoiceAmount,InvoiceCurrency,LSP,ManifestNo,MAWB,ModeOfTransport,ModeOfTransportTxt,Remarks,Shipper,SourceSystem,TotalPackages,TruckNumber,TransportTripNo,UDR","filterProperty":"HeaderID","sortProperty":"HeaderID"}'
			})).setLabel(new Text({
				text: "",
				visible: false
			})).setTemplate(new RowAction({
				items: [
					new RowActionItem({
						type: "Navigation",
						press: that.onListItemPress
					})
				]
			})));
		},

		/**
		 * Set the full screen mode to false and navigate to role page
		 */
		onCloseMasterPress: function() {
			var oViewModel = that.getModel("masterView");
			oViewModel.setProperty("/HKOnly", false);
			oViewModel.setProperty("/NotHK", false);
			oViewModel.setProperty("/RawMaterial", false);
			oViewModel.setProperty("/declarationSelected", false);

			var oSfb = that.byId("smartFilterBar");
			oSfb.fireClear();
			that.getRouter().navTo("role", {});
		},

		onClear: function() {
			// that.byId("countrySelect").close().setSelectedKey(""); // TODO reset to default?
			that.byId("modeOfTransportSelect").close().setSelectedKey("");
			that.byId("relatedTransactionFlagSelect").close().setSelectedKey("");
			that.byId("fulFillmentSourceSelect").close().setSelectedKey("");
			that.byId("hsCodeStatusSelect").close().setSelectedKey("");
			that.byId("sourceSystemSelect").close().setSelectedKey("");
			that.byId("etwSelect").close().setSelectedKey("");
			that.byId("deviceTypeSelect").close().setSelectedKey("10");

			that.byId("importDateRangeSelection").setDateValue(null).setSecondDateValue(null);
			that.byId("exportDateRangeSelection").setValue(null).setSecondDateValue(null);
			that.byId("shippingDateRangeSelection").setValue(null).setSecondDateValue(null);
			that.byId("createDateRangeSelection").setValue(null).setSecondDateValue(null);
			that.byId("declarationDateRangeSelection").setValue(null).setSecondDateValue(null);

			var oViewModel = that.getModel("masterView");
			oViewModel.setProperty("/HKOnly", false);
			oViewModel.setProperty("/NotHK", false);
			oViewModel.setProperty("/RawMaterial", false);

			that.byId("countrySelect").fireChange({
				selectedItem: null
			});

			that.byId("declarationTable").clearSelection();
			oViewModel.setProperty("/declarationSelected", false);

			that.onSearch();
		},

		onSearch: function() {
			that.onCountryChange();

			var oSmartTable = that.byId("smartTable");
			oSmartTable.rebindTable();
		},

		onExport: function() {
			var aCols, oRowBinding, oSettings, oTable;

			if (!that._oTable) {
				that._oTable = that.byId("declarationTable");
			}

			oTable = that._oTable;
			oRowBinding = oTable.getBinding("rows");

			var documents = [];
			for (var i = 0; i < that.aDocumentNo.length; i++) {
				var document = that.aDocumentNo[i];
				documents.push(new sap.ui.model.Filter("DocumentNo", sap.ui.model.FilterOperator.EQ, document));
			}

			var oFilters = new sap.ui.model.Filter({
				filters: documents,
				and: false
			});
			oRowBinding.filter(oFilters, sap.ui.model.FilterType.Application);

			aCols = that.createColumnConfig();

			var oModel = oRowBinding.getModel();
			var oModelInterface = oModel.getInterface();

			oSettings = {
				workbook: { columns: aCols },
				dataSource: {
					type: "oData",
					dataUrl: oRowBinding.getDownloadUrl ? oRowBinding.getDownloadUrl() : null,
					serviceUrl: oModelInterface.sServiceUrl,
					headers: oModelInterface.getHeaders ? oModelInterface.getHeaders() : null,
					count: oRowBinding.getLength ? oRowBinding.getLength() : null,
					useBatch: oModelInterface.bUseBatch,
					sizeLimit: oModelInterface.iSizeLimit
				},
				worker: false // We need to disable worker because we are using a MockServer as OData Service
			};

			new Spreadsheet(oSettings).build();
			that.byId("smartTable").rebindTable();
		},

		createColumnConfig: function() {
			var oViewModel = that.getModel("masterView");
			var bHK = oViewModel.getProperty("/HKOnly");
			var sKey = oViewModel.getProperty("/selectedTab");

			var mLabels = {};
			var aProperties = that.getModel().getMetaModel().getODataEntityType("ZCBS_DET_SRV.ZCBS_C_DETHType").property;
			for (var i in aProperties) {
				var oProperty = aProperties[i];
				mLabels[oProperty.name] = oProperty["sap:label"];
			}

			var aCols = [];

			if (bHK && that._sBusinessType === "20" && that._sImpExpIndicator === "2") {
				aCols.push({
					label: mLabels["DocumentNo"],
					property: "DocumentNo",
					type: "string"
				});

				aCols.push({
					label: mLabels["DocumentYear"],
					property: "DocumentYear",
					type: "string"
				});

				aCols.push({
					label: mLabels["BANO"],
					property: "BANO",
					type: "string"
				});

				aCols.push({
					label: mLabels["TruckNumber"],
					property: "TruckNumber",
					type: "string"
				});

				aCols.push({
					label: mLabels["VehicleNo"],
					property: "VehicleNo",
					type: "string"
				});

				aCols.push({
					label: mLabels["ManifestNo"],
					property: "ManifestNo",
					type: "string"
				});

				aCols.push({
					label: mLabels["ShippingDate"],
					property: "ExportDate",
					type: "string"
				});

				aCols.push({
					label: mLabels["TotalPackages"],
					property: "TotalPackages",
					type: "string"
				});

				aCols.push({
					label: mLabels["Shipper"],
					property: "Shipper",
					type: "string"
				});

				aCols.push({
					label: mLabels["Consignee"],
					property: "Consignee",
					type: "string"
				});

				aCols.push({
					label: mLabels["Remarks"],
					property: "Remarks",
					type: "string"
				});

				aCols.push({
					label: mLabels["CCRN"],
					property: "CCRN",
					type: "string"
				});

				aCols.push({
					label: mLabels["CAT"],
					property: "CAT",
					type: "string"
				});
			} else {
				aCols.push({
					label: mLabels["DocumentNo"],
					property: "DocumentNo",
					type: "string"
				});

				if (!((sKey === "10" || sKey === "30" || sKey === "40") && bHK && that._sImpExpIndicator === "1" && that._sBusinessType === "20")) {
					aCols.push({
						label: mLabels["BANO"],
						property: "BANO",
						type: "string"
					});

					aCols.push({
						label: mLabels["ManifestNo"],
						property: "ManifestNo",
						type: "string"
					});
				}

				aCols.push({
					label: mLabels["HAWB"],
					property: "HAWB",
					type: "string"
				});

				if ((sKey === "10" || sKey === "30" || sKey === "40") && bHK && that._sBusinessType === "20") {
					aCols.push({
						label: mLabels["MAWB"],
						property: "MAWB",
						type: "string"
					});
				}

				aCols.push({
					label: mLabels["Company"],
					property: "Company",
					type: "string"
				});

				aCols.push({
					label: mLabels["Shipper"],
					property: "Shipper",
					type: "string"
				});

				aCols.push({
					label: mLabels["Consignee"],
					property: "Consignee",
					type: "string"
				});

				if (!((sKey === "10" || sKey === "30" || sKey === "40") && bHK && that._sImpExpIndicator === "1" && that._sBusinessType === "20")) {
					aCols.push({
						label: mLabels["DestinationCountry"],
						property: "DestinationCountryTxt",
						type: "string"
					});
				}

				if (!((sKey === "10" || sKey === "30" || sKey === "40") && bHK && that._sBusinessType === "20")) {
					aCols.push({
						label: mLabels["ModeOfTransport"],
						property: "ModeOfTransportTxt",
						type: "string"
					});
				}

				if ((sKey === "10" || sKey === "30" || sKey === "40") && bHK && that._sImpExpIndicator === "1" && that._sBusinessType === "20") {
					aCols.push({
						label: mLabels["TruckNumber"],
						property: "TruckNumber",
						type: "string"
					});
				}

				if ((sKey === "10" || sKey === "30" || sKey === "40") && bHK && that._sBusinessType === "20") {
					aCols.push({
						label: mLabels["ExpressTrackingNo"],
						property: "ExpressTrackingNo",
						type: "string"
					});

					aCols.push({
						label: mLabels["TotalPackages"],
						property: "TotalPackages",
						type: "string"
					});

					aCols.push({
						label: mLabels["BOEAmount"],
						property: "BOEAmount",
						type: "string"
					});

					aCols.push({
						label: mLabels["BOECurrency"],
						property: "BOECurrency",
						type: "string"
					});

					aCols.push({
						label: mLabels["LSP"],
						property: "LSP",
						type: "string"
					});

					aCols.push({
						label: mLabels["CreatedByUser"],
						property: "CreatedByUser",
						type: "string"
					});
				}

				aCols.push({
					label: mLabels["CreateDate"],
					property: "CreateDate",
					type: "string"
				});

				if (bHK) {
					if (that._sImpExpIndicator === "1") {
						aCols.push({
							label: mLabels["ImportDate"],
							property: "ImportDate",
							type: "string"
						});
					}
					if (that._sImpExpIndicator === "2") {
						aCols.push({
							label: mLabels["ExportDate"],
							property: "ExportDate",
							type: "string"
						});
					}
				}

				if (!((sKey === "10" || sKey === "30" || sKey === "40") && bHK && that._sBusinessType === "20")) {
					aCols.push({
						label: mLabels["ShippingDate"],
						property: "ShippingDate",
						type: "string"
					});
				}

				if ((sKey === "10" || sKey === "30" || sKey === "40") && bHK && that._sImpExpIndicator === "2" && that._sBusinessType === "20") {
					aCols.push({
						label: mLabels["ModeOfTransport"],
						property: "ModeOfTransportTxt",
						type: "string"
					});
				}
			}

			aCols.push({
				label: mLabels["UDR"],
				property: "UDR",
				type: "string"
			});

			return aCols;
		},

		onUpload: function() {
			window.open("/sap/bc/gui/sap/its/webgui?~transaction=ZCBS_DET_UPDATE_CAT");
		},

		onRefresh: function() {
			if (that.aHSCodeStatus.length <= 0) {
				return;
			}

			var bContinue = true;
			for (var i = 0; i < that.aHSCodeStatus.length; i++) {
				var sHSCodeStatus = that.aHSCodeStatus[i];
				if (sHSCodeStatus === "Y") {
					bContinue = false;
					break;
				}
			}

			if (bContinue) {
				that._openChangeStatusMessageBox("Refresh");
			} else {
				MessageBox.error("Only HS Code Status with 'N' can be refreshed!", {
					styleClass: that.getOwnerComponent().getContentDensityClass()
				});
			}
		},

		onSubmit: function() {
			that._openChangeStatusMessageBox("Submit");
		},

		onCancel: function() {
			that._openChangeStatusMessageBox("Cancel");
		},

		_openChangeStatusMessageBox: function(sAction) {
			if (that.aDocumentNo.length <= 0) {
				return;
			}
			var sDeclarationMessage = that.aDocumentNo.join(",");
			var sChangeStatusMessage = "";
			switch (sAction) {
				case "Submit":
					sChangeStatusMessage = "Submit Declarations: " + sDeclarationMessage + " ?";
					break;
				case "Cancel":
					sChangeStatusMessage = "Delete Declarations: " + sDeclarationMessage + " ?";
					break;
				case "Refresh":
					sChangeStatusMessage = "Refresh HS Code for Declarations: " + sDeclarationMessage + " ?";
					break;
				default:
					break;
			}

			MessageBox.confirm(
				sChangeStatusMessage, {
					styleClass: that.getOwnerComponent().getContentDensityClass(),
					actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
					onClose: function(oAction) {
						if (oAction === sap.m.MessageBox.Action.YES) {
							that._changeDeclarationStatus(sAction);
						}
					}
				}
			);
		},

		_changeDeclarationStatus: function(sAction) {
			var oTable = that.byId("declarationTable");
			oTable.setBusy(true);

			var sHeaderIDs = that.aHeaderID.join(",");
			var sDeclarationMessage = that.aDocumentNo.join(",");
			that.getModel().callFunction("/UpdateStatus", {
				method: "POST",
				groupId: "UpdateStatus_" + new Date().getTime(),
				urlParameters: {
					HeaderID: sHeaderIDs,
					Action: sAction
				},
				success: function(oData, response) {
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
						if (sAction !== "Cancel") {
							MessageBox.success(that.getResourceBundle().getText("Successfully " + sAction) + " Declarations: " + sDeclarationMessage, {
								styleClass: that.getOwnerComponent().getContentDensityClass()
							});
						}

						// update detail page
						var oOwnerComponent = that.getOwnerComponent();
						var oDetailView = oOwnerComponent._oViews._oViews[that._viewPrefix + "Detail"];
						if (oDetailView) {
							var oDetailController = oDetailView.getController();
							oDetailController.getModel().deleteCreatedEntry(oDetailController.getView().getBindingContext());
							oDetailController.getView().unbindElement();
							oDetailController._bindView("/" + oDetailController._sBindPath);
						}
					}

					that.onSearch();
					oTable.setBusy(false);
				},
				error: function() {
					that.onSearch();
					oTable.setBusy(false);
					MessageBox.error("An error happened when " + sAction + " Declarations: " + sDeclarationMessage, {
						styleClass: that.getOwnerComponent().getContentDensityClass()
					});
				}
			});
		},

		onSelectFtoSearch: function(oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter1 = new sap.ui.model.Filter("ParNumber", sap.ui.model.FilterOperator.Contains, sValue);
			var oFilter2 = new sap.ui.model.Filter("ParName", sap.ui.model.FilterOperator.Contains, sValue);
			var oFilter = new sap.ui.model.Filter([ oFilter1, oFilter2 ], false);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		onSelectFtoClose: function(oEvent) {
			var aContexts = oEvent.getParameter("selectedContexts");
			if (aContexts && aContexts.length) {
				var oContext = aContexts[0];
				var sCompanyBpId = oContext.getObject().ParNumber;

				// set the layout property of FCL control to show two columns
				that.getModel("appView").setProperty("/uiState/layout", "MidColumnFullScreen");
				that.getRouter().navTo("detailCreate", {
					BUSTYPE: that._sBusinessType,
					INDEI: that._sImpExpIndicator,
					companyBpId: sCompanyBpId
				});
			} else {
				// MessageToast.show("No new item was selected.");
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		onCreate: function() {
			// Open the FTO Select dialog 
			that._selectFtoDialog.open();
		},

		onBeforeRebindTable: function(oEvent) {
			var mBindingParams = oEvent.getParameter("bindingParams");
			var oViewModel = that.getModel("masterView");
			var array = [];
			if (that._sImpExpIndicator) {
				array.push(new sap.ui.model.Filter("ImportOrExport", "EQ", that._sImpExpIndicator));
			}
			if (that._sBusinessType) {
				array.push(new sap.ui.model.Filter("BusinessType", "EQ", that._sBusinessType));
				if (that._sBusinessType === "10") {
					oViewModel.setProperty("/RawMaterial", false);
				} else {
					oViewModel.setProperty("/RawMaterial", true);
				}
			}
			var oCountrySelectedItem = that.byId("countrySelect").getSelectedItem();
			if (oCountrySelectedItem) {
				var sCountry = oCountrySelectedItem.getBindingContext().getObject().CountryKey;
				if (sCountry !== null && sCountry !== "") {
					array.push(new sap.ui.model.Filter("Country", sap.ui.model.FilterOperator.EQ, sCountry));
				}
				if (sCountry === null || sCountry === "") {
					oViewModel.setProperty("/HKOnly", false);
					oViewModel.setProperty("/NotHK", false);
				} else {
					if (sCountry === "HK") {
						oViewModel.setProperty("/HKOnly", true);
						oViewModel.setProperty("/NotHK", false);
					} else {
						oViewModel.setProperty("/HKOnly", false);
						oViewModel.setProperty("/NotHK", true);
					}
				}
			}
			var oModeOfTransportSelectedItem = that.byId("modeOfTransportSelect").getSelectedItem();
			if (oModeOfTransportSelectedItem) {
				var sModeOfTransport = oModeOfTransportSelectedItem.getBindingContext().getObject().Motra;
				if (sModeOfTransport !== null && sModeOfTransport !== "") {
					array.push(new sap.ui.model.Filter("ModeOfTransport", sap.ui.model.FilterOperator.EQ, sModeOfTransport));
				}
			}
			var oRelatedTransactionFlagSelectedItem = that.byId("relatedTransactionFlagSelect").getSelectedItem();
			if (oRelatedTransactionFlagSelectedItem) {
				var sRelatedTransactionFlag = oRelatedTransactionFlagSelectedItem.getKey();
				if (sRelatedTransactionFlag !== null && sRelatedTransactionFlag !== "") {
					array.push(new sap.ui.model.Filter("RelatedTransactionFlag", sap.ui.model.FilterOperator.EQ, sRelatedTransactionFlag));
				}
			}
			var oFulFillmentSourceSelectedItem = that.byId("fulFillmentSourceSelect").getSelectedItem();
			if (oFulFillmentSourceSelectedItem) {
				var sFulFillmentSource = oFulFillmentSourceSelectedItem.getBindingContext().getObject().DomainValue;
				if (sFulFillmentSource !== null && sFulFillmentSource !== "") {
					array.push(new sap.ui.model.Filter("FulFillmentSource", sap.ui.model.FilterOperator.EQ, sFulFillmentSource));
				}
			}
			var oSourceSystemSelectedItem = that.byId("sourceSystemSelect").getSelectedItem();
			if (oSourceSystemSelectedItem) {
				var sSourceSystem = oSourceSystemSelectedItem.getKey();
				if (sSourceSystem !== null && sSourceSystem !== "") {
					array.push(new sap.ui.model.Filter("SourceSystem", sap.ui.model.FilterOperator.EQ, sSourceSystem));
				}
			}
			var oHSCodeStatusSelectedItem = that.byId("hsCodeStatusSelect").getSelectedItem();
			if (oHSCodeStatusSelectedItem) {
				var sHSCodeStatus = oHSCodeStatusSelectedItem.getKey();
				if (sHSCodeStatus !== null && sHSCodeStatus !== "") {
					array.push(new sap.ui.model.Filter("HSCodeStatus", sap.ui.model.FilterOperator.EQ, sHSCodeStatus));
				}
			}
			var oDeviceTypeSelectedItem = that.byId("deviceTypeSelect").getSelectedItem();
			if (oDeviceTypeSelectedItem) {
				var sDeviceType = oDeviceTypeSelectedItem.getKey();
				if (sDeviceType !== null && sDeviceType !== "") {
					if (sDeviceType === "10") { // All
						var oFilter1 = new sap.ui.model.Filter("DeviceType", sap.ui.model.FilterOperator.EQ, "20");
						var oFilter2 = new sap.ui.model.Filter("DeviceType", sap.ui.model.FilterOperator.EQ, "30");
						array.push(new sap.ui.model.Filter([ oFilter1, oFilter2 ], false));
					} else {
						array.push(new sap.ui.model.Filter("DeviceType", sap.ui.model.FilterOperator.EQ, sDeviceType));
					}
				}
			}
			var oETWSelectedItem = that.byId("etwSelect").getSelectedItem();
			if (oETWSelectedItem) {
				var sETW = oETWSelectedItem.getKey();
				if (sETW !== null && sETW !== "") {
					array.push(new sap.ui.model.Filter("ETW", sap.ui.model.FilterOperator.EQ, sETW));
				}
			}

			var oDateFormat = DateFormat.getDateTimeInstance({
				pattern: "yyyyMMdd"
			});
			var oImportDateRangeSelection = that.byId("importDateRangeSelection");
			if (oImportDateRangeSelection.getSecondDateValue()) {
				var sImportDateFrom = oDateFormat.format(oImportDateRangeSelection.getDateValue());
				var sImportDateTo = oDateFormat.format(oImportDateRangeSelection.getSecondDateValue());
				if (sImportDateTo !== null && sImportDateTo !== "") {
					array.push(new sap.ui.model.Filter("ImportDate", sap.ui.model.FilterOperator.GE, sImportDateFrom));
					array.push(new sap.ui.model.Filter("ImportDate", sap.ui.model.FilterOperator.LE, sImportDateTo));
				}
			}
			var oExportDateRangeSelection = that.byId("exportDateRangeSelection");
			if (oExportDateRangeSelection.getSecondDateValue()) {
				var sExportDateFrom = oDateFormat.format(oExportDateRangeSelection.getDateValue());
				var sExportDateTo = oDateFormat.format(oExportDateRangeSelection.getSecondDateValue());
				if (sExportDateTo !== null && sExportDateTo !== "") {
					array.push(new sap.ui.model.Filter("ExportDate", sap.ui.model.FilterOperator.GE, sExportDateFrom));
					array.push(new sap.ui.model.Filter("ExportDate", sap.ui.model.FilterOperator.LE, sExportDateTo));
				}
			}
			var oShippingDateRangeSelection = that.byId("shippingDateRangeSelection");
			if (oShippingDateRangeSelection.getSecondDateValue()) {
				var sShippingDateFrom = oDateFormat.format(oShippingDateRangeSelection.getDateValue());
				var sShippingDateTo = oDateFormat.format(oShippingDateRangeSelection.getSecondDateValue());
				if (sShippingDateTo !== null && sShippingDateTo !== "") {
					array.push(new sap.ui.model.Filter("ShippingDate", sap.ui.model.FilterOperator.GE, sShippingDateFrom));
					array.push(new sap.ui.model.Filter("ShippingDate", sap.ui.model.FilterOperator.LE, sShippingDateTo));
				}
			}
			var oCreateDateRangeSelection = that.byId("createDateRangeSelection");
			if (oCreateDateRangeSelection.getSecondDateValue()) {
				var sCreateDateFrom = oDateFormat.format(oCreateDateRangeSelection.getDateValue());
				var sCreateDateTo = oDateFormat.format(oCreateDateRangeSelection.getSecondDateValue());
				if (sCreateDateTo !== null && sCreateDateTo !== "") {
					array.push(new sap.ui.model.Filter("CreateDate", sap.ui.model.FilterOperator.GE, sCreateDateFrom));
					array.push(new sap.ui.model.Filter("CreateDate", sap.ui.model.FilterOperator.LE, sCreateDateTo));
				}
			}
			var oDeclarationDateRangeSelection = that.byId("declarationDateRangeSelection");
			if (oDeclarationDateRangeSelection.getSecondDateValue()) {
				var sDeclarationDateFrom = oDateFormat.format(oDeclarationDateRangeSelection.getDateValue());
				var sDeclarationDateTo = oDateFormat.format(oDeclarationDateRangeSelection.getSecondDateValue());
				if (sDeclarationDateTo !== null && sDeclarationDateTo !== "") {
					array.push(new sap.ui.model.Filter("DeclarationDate", sap.ui.model.FilterOperator.GE, sDeclarationDateFrom));
					array.push(new sap.ui.model.Filter("DeclarationDate", sap.ui.model.FilterOperator.LE, sDeclarationDateTo));
				}
			}

			var sKey = oViewModel.getProperty("/selectedTab");
			if (sKey === "all") {
				array.push(
					new sap.ui.model.Filter([
						new sap.ui.model.Filter("Status", "EQ", "00"),
						new sap.ui.model.Filter("Status", "EQ", "10"),
						new sap.ui.model.Filter("Status", "EQ", "30"),
						new sap.ui.model.Filter("Status", "EQ", "40"),
						new sap.ui.model.Filter("Status", "EQ", "50"),
						new sap.ui.model.Filter("Status", "EQ", "60"),
						new sap.ui.model.Filter("Status", "EQ", "65"),
						new sap.ui.model.Filter("Status", "EQ", "70")
					], false)
				);
			} else if (sKey === "10") {
				array.push(
					new sap.ui.model.Filter([
						new sap.ui.model.Filter("Status", "EQ", "00"),
						new sap.ui.model.Filter("Status", "EQ", "10")
					], false)
				);
			} else {
				array.push(new sap.ui.model.Filter("Status", "EQ", sKey));
			}

			var aFilters = mBindingParams.filters;
			for (var i in aFilters) {
				var aFilter = aFilters[i];
				array.push(aFilter);
			}

			that.bNoSorter = false;
			if (!that.oSorter) {
				that.bNoSorter = true;
				that.oSorter = new Sorter("DocumentNo", true);
			}
			mBindingParams.sorter = that.oSorter;
			mBindingParams.filters = new sap.ui.model.Filter(array, true);
			that.aFilter = mBindingParams.filters;

			that._setTabCount();

			that.byId("declarationTable").clearSelection();
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

		_setTabCount: function() {
			var oViewModel = that.getModel("masterView");
			var oSfb = that.byId("smartFilterBar");
			if (!oSfb.bIsInitialised) {
				return;
			}

			var array = [];
			var aFilters = oSfb.getFilters();
			for (var i in aFilters) {
				var aFilter = aFilters[i];
				array.push(aFilter);
			}
			if (that._sImpExpIndicator) {
				array.push(new sap.ui.model.Filter("ImportOrExport", "EQ", that._sImpExpIndicator));
			}
			if (that._sBusinessType) {
				array.push(new sap.ui.model.Filter("BusinessType", "EQ", that._sBusinessType));
				if (that._sBusinessType === "10") {
					oViewModel.setProperty("/RawMaterial", false);
				} else {
					oViewModel.setProperty("/RawMaterial", true);
				}
			}
			var oCountrySelectedItem = that.byId("countrySelect").getSelectedItem();
			if (oCountrySelectedItem) {
				var sCountry = oCountrySelectedItem.getBindingContext().getObject().CountryKey;
				if (sCountry !== null && sCountry !== "") {
					array.push(new sap.ui.model.Filter("Country", sap.ui.model.FilterOperator.EQ, sCountry));
				}
			}
			var oModeOfTransportSelectedItem = that.byId("modeOfTransportSelect").getSelectedItem();
			if (oModeOfTransportSelectedItem) {
				var sModeOfTransport = oModeOfTransportSelectedItem.getBindingContext().getObject().Motra;
				if (sModeOfTransport !== null && sModeOfTransport !== "") {
					array.push(new sap.ui.model.Filter("ModeOfTransport", sap.ui.model.FilterOperator.EQ, sModeOfTransport));
				}
			}
			var oRelatedTransactionFlagSelectedItem = that.byId("relatedTransactionFlagSelect").getSelectedItem();
			if (oRelatedTransactionFlagSelectedItem) {
				var sRelatedTransactionFlag = oRelatedTransactionFlagSelectedItem.getKey();
				if (sRelatedTransactionFlag !== null && sRelatedTransactionFlag !== "") {
					array.push(new sap.ui.model.Filter("RelatedTransactionFlag", sap.ui.model.FilterOperator.EQ, sRelatedTransactionFlag));
				}
			}
			var oFulFillmentSourceSelectedItem = that.byId("fulFillmentSourceSelect").getSelectedItem();
			if (oFulFillmentSourceSelectedItem) {
				var sFulFillmentSource = oFulFillmentSourceSelectedItem.getBindingContext().getObject().DomainValue;
				if (sFulFillmentSource !== null && sFulFillmentSource !== "") {
					array.push(new sap.ui.model.Filter("FulFillmentSource", sap.ui.model.FilterOperator.EQ, sFulFillmentSource));
				}
			}
			var oSourceSystemSelectedItem = that.byId("sourceSystemSelect").getSelectedItem();
			if (oSourceSystemSelectedItem) {
				var sSourceSystem = oSourceSystemSelectedItem.getKey();
				if (sSourceSystem !== null && sSourceSystem !== "") {
					array.push(new sap.ui.model.Filter("SourceSystem", sap.ui.model.FilterOperator.EQ, sSourceSystem));
				}
			}
			var oHSCodeStatusSelectedItem = that.byId("hsCodeStatusSelect").getSelectedItem();
			if (oHSCodeStatusSelectedItem) {
				var sHSCodeStatus = oHSCodeStatusSelectedItem.getKey();
				if (sHSCodeStatus !== null && sHSCodeStatus !== "") {
					array.push(new sap.ui.model.Filter("HSCodeStatus", sap.ui.model.FilterOperator.EQ, sHSCodeStatus));
				}
			}
			var oDeviceTypeSelectedItem = that.byId("deviceTypeSelect").getSelectedItem();
			if (oDeviceTypeSelectedItem) {
				var sDeviceType = oDeviceTypeSelectedItem.getKey();
				if (sDeviceType !== null && sDeviceType !== "") {
					if (sDeviceType === "10") { // All
						var oFilter1 = new sap.ui.model.Filter("DeviceType", sap.ui.model.FilterOperator.EQ, "20");
						var oFilter2 = new sap.ui.model.Filter("DeviceType", sap.ui.model.FilterOperator.EQ, "30");
						array.push(new sap.ui.model.Filter([ oFilter1, oFilter2 ], false));
					} else {
						array.push(new sap.ui.model.Filter("DeviceType", sap.ui.model.FilterOperator.EQ, sDeviceType));
					}
				}
			}
			var oETWSelectedItem = that.byId("etwSelect").getSelectedItem();
			if (oETWSelectedItem) {
				var sETW = oETWSelectedItem.getKey();
				if (sETW !== null && sETW !== "") {
					array.push(new sap.ui.model.Filter("ETW", sap.ui.model.FilterOperator.EQ, sETW));
				}
			}

			var oDateFormat = DateFormat.getDateTimeInstance({
				pattern: "yyyyMMdd"
			});
			var oImportDateRangeSelection = that.byId("importDateRangeSelection");
			if (oImportDateRangeSelection.getSecondDateValue()) {
				var sImportDateFrom = oDateFormat.format(oImportDateRangeSelection.getDateValue());
				var sImportDateTo = oDateFormat.format(oImportDateRangeSelection.getSecondDateValue());
				if (sImportDateTo !== null && sImportDateTo !== "") {
					array.push(new sap.ui.model.Filter("ImportDate", sap.ui.model.FilterOperator.GE, sImportDateFrom));
					array.push(new sap.ui.model.Filter("ImportDate", sap.ui.model.FilterOperator.LE, sImportDateTo));
				}
			}
			var oExportDateRangeSelection = that.byId("exportDateRangeSelection");
			if (oExportDateRangeSelection.getSecondDateValue()) {
				var sExportDateFrom = oDateFormat.format(oExportDateRangeSelection.getDateValue());
				var sExportDateTo = oDateFormat.format(oExportDateRangeSelection.getSecondDateValue());
				if (sExportDateTo !== null && sExportDateTo !== "") {
					array.push(new sap.ui.model.Filter("ExportDate", sap.ui.model.FilterOperator.GE, sExportDateFrom));
					array.push(new sap.ui.model.Filter("ExportDate", sap.ui.model.FilterOperator.LE, sExportDateTo));
				}
			}
			var oShippingDateRangeSelection = that.byId("shippingDateRangeSelection");
			if (oShippingDateRangeSelection.getSecondDateValue()) {
				var sShippingDateFrom = oDateFormat.format(oShippingDateRangeSelection.getDateValue());
				var sShippingDateTo = oDateFormat.format(oShippingDateRangeSelection.getSecondDateValue());
				if (sShippingDateTo !== null && sShippingDateTo !== "") {
					array.push(new sap.ui.model.Filter("ShippingDate", sap.ui.model.FilterOperator.GE, sShippingDateFrom));
					array.push(new sap.ui.model.Filter("ShippingDate", sap.ui.model.FilterOperator.LE, sShippingDateTo));
				}
			}
			var oCreateDateRangeSelection = that.byId("createDateRangeSelection");
			if (oCreateDateRangeSelection.getSecondDateValue()) {
				var sCreateDateFrom = oDateFormat.format(oCreateDateRangeSelection.getDateValue());
				var sCreateDateTo = oDateFormat.format(oCreateDateRangeSelection.getSecondDateValue());
				if (sCreateDateTo !== null && sCreateDateTo !== "") {
					array.push(new sap.ui.model.Filter("CreateDate", sap.ui.model.FilterOperator.GE, sCreateDateFrom));
					array.push(new sap.ui.model.Filter("CreateDate", sap.ui.model.FilterOperator.LE, sCreateDateTo));
				}
			}
			var oDeclarationDateRangeSelection = that.byId("declarationDateRangeSelection");
			if (oDeclarationDateRangeSelection.getSecondDateValue()) {
				var sDeclarationDateFrom = oDateFormat.format(oDeclarationDateRangeSelection.getDateValue());
				var sDeclarationDateTo = oDateFormat.format(oDeclarationDateRangeSelection.getSecondDateValue());
				if (sDeclarationDateTo !== null && sDeclarationDateTo !== "") {
					array.push(new sap.ui.model.Filter("DeclarationDate", sap.ui.model.FilterOperator.GE, sDeclarationDateFrom));
					array.push(new sap.ui.model.Filter("DeclarationDate", sap.ui.model.FilterOperator.LE, sDeclarationDateTo));
				}
			}

			var statuses = ["10", "30", "40", "50", "60", "65", "70"];
			that.getModel().read("/Zcbs_C_Dethgrp", {
				filters: [new sap.ui.model.Filter(array, true)],
				success: function (oData) {
					var iAllCount = 0;
					for (var i in oData.results) {
						var result = oData.results[i];
						if (result && result.Status && statuses.indexOf(result.Status) > -1) {
							iAllCount = iAllCount + Number(result.CountNumber);
							oViewModel.setProperty("/count/" + result.Status, result.CountNumber);
						}
					}
					oViewModel.setProperty("/count/all", iAllCount);
				}
			});

//			function _getCount(sKey) {
//				var array = [];
//				var aFilters = oSfb.getFilters();
//				for (var i in aFilters) {
//					var aFilter = aFilters[i];
//					array.push(aFilter);
//				}
//				if (that._sImpExpIndicator) {
//					array.push(new sap.ui.model.Filter("ImportOrExport", "EQ", that._sImpExpIndicator));
//				}
//				if (that._sBusinessType) {
//					array.push(new sap.ui.model.Filter("BusinessType", "EQ", that._sBusinessType));
//					if (that._sBusinessType === "10") {
//						oViewModel.setProperty("/RawMaterial", false);
//					} else {
//						oViewModel.setProperty("/RawMaterial", true);
//					}
//				}
//				var oCountrySelectedItem = that.byId("countrySelect").getSelectedItem();
//				if (oCountrySelectedItem) {
//					var sCountry = oCountrySelectedItem.getBindingContext().getObject().CountryKey;
//					if (sCountry !== null && sCountry !== "") {
//						array.push(new sap.ui.model.Filter("Country", sap.ui.model.FilterOperator.EQ, sCountry));
//					}
//				}
//				var oModeOfTransportSelectedItem = that.byId("modeOfTransportSelect").getSelectedItem();
//				if (oModeOfTransportSelectedItem) {
//					var sModeOfTransport = oModeOfTransportSelectedItem.getBindingContext().getObject().Motra;
//					if (sModeOfTransport !== null && sModeOfTransport !== "") {
//						array.push(new sap.ui.model.Filter("ModeOfTransport", sap.ui.model.FilterOperator.EQ, sModeOfTransport));
//					}
//				}
//				var oRelatedTransactionFlagSelectedItem = that.byId("relatedTransactionFlagSelect").getSelectedItem();
//				if (oRelatedTransactionFlagSelectedItem) {
//					var sRelatedTransactionFlag = oRelatedTransactionFlagSelectedItem.getKey();
//					if (sRelatedTransactionFlag !== null && sRelatedTransactionFlag !== "") {
//						array.push(new sap.ui.model.Filter("RelatedTransactionFlag", sap.ui.model.FilterOperator.EQ, sRelatedTransactionFlag));
//					}
//				}
//				var oFulFillmentSourceSelectedItem = that.byId("fulFillmentSourceSelect").getSelectedItem();
//				if (oFulFillmentSourceSelectedItem) {
//					var sFulFillmentSource = oFulFillmentSourceSelectedItem.getBindingContext().getObject().DomainValue;
//					if (sFulFillmentSource !== null && sFulFillmentSource !== "") {
//						array.push(new sap.ui.model.Filter("FulFillmentSource", sap.ui.model.FilterOperator.EQ, sFulFillmentSource));
//					}
//				}
//				var oSourceSystemSelectedItem = that.byId("sourceSystemSelect").getSelectedItem();
//				if (oSourceSystemSelectedItem) {
//					var sSourceSystem = oSourceSystemSelectedItem.getKey();
//					if (sSourceSystem !== null && sSourceSystem !== "") {
//						array.push(new sap.ui.model.Filter("SourceSystem", sap.ui.model.FilterOperator.EQ, sSourceSystem));
//					}
//				}
//				var oHSCodeStatusSelectedItem = that.byId("hsCodeStatusSelect").getSelectedItem();
//				if (oHSCodeStatusSelectedItem) {
//					var sHSCodeStatus = oHSCodeStatusSelectedItem.getKey();
//					if (sHSCodeStatus !== null && sHSCodeStatus !== "") {
//						array.push(new sap.ui.model.Filter("HSCodeStatus", sap.ui.model.FilterOperator.EQ, sHSCodeStatus));
//					}
//				}
//				var oDeviceTypeSelectedItem = that.byId("deviceTypeSelect").getSelectedItem();
//				if (oDeviceTypeSelectedItem) {
//					var sDeviceType = oDeviceTypeSelectedItem.getKey();
//					if (sDeviceType !== null && sDeviceType !== "") {
//						if (sDeviceType === "10") { // All
//							var oFilter1 = new sap.ui.model.Filter("DeviceType", sap.ui.model.FilterOperator.EQ, "20");
//							var oFilter2 = new sap.ui.model.Filter("DeviceType", sap.ui.model.FilterOperator.EQ, "30");
//							array.push(new sap.ui.model.Filter([ oFilter1, oFilter2 ], false));
//						} else {
//							array.push(new sap.ui.model.Filter("DeviceType", sap.ui.model.FilterOperator.EQ, sDeviceType));
//						}
//					}
//				}
//				var oETWSelectedItem = that.byId("etwSelect").getSelectedItem();
//				if (oETWSelectedItem) {
//					var sETW = oETWSelectedItem.getKey();
//					if (sETW !== null && sETW !== "") {
//						array.push(new sap.ui.model.Filter("ETW", sap.ui.model.FilterOperator.EQ, sETW));
//					}
//				}

//				var oDateFormat = DateFormat.getDateTimeInstance({
//					pattern: "yyyyMMdd"
//				});
//				var oImportDateRangeSelection = that.byId("importDateRangeSelection");
//				if (oImportDateRangeSelection.getSecondDateValue()) {
//					var sImportDateFrom = oDateFormat.format(oImportDateRangeSelection.getDateValue());
//					var sImportDateTo = oDateFormat.format(oImportDateRangeSelection.getSecondDateValue());
//					if (sImportDateTo !== null && sImportDateTo !== "") {
//						array.push(new sap.ui.model.Filter("ImportDate", sap.ui.model.FilterOperator.GE, sImportDateFrom));
//						array.push(new sap.ui.model.Filter("ImportDate", sap.ui.model.FilterOperator.LE, sImportDateTo));
//					}
//				}
//				var oExportDateRangeSelection = that.byId("exportDateRangeSelection");
//				if (oExportDateRangeSelection.getSecondDateValue()) {
//					var sExportDateFrom = oDateFormat.format(oExportDateRangeSelection.getDateValue());
//					var sExportDateTo = oDateFormat.format(oExportDateRangeSelection.getSecondDateValue());
//					if (sExportDateTo !== null && sExportDateTo !== "") {
//						array.push(new sap.ui.model.Filter("ExportDate", sap.ui.model.FilterOperator.GE, sExportDateFrom));
//						array.push(new sap.ui.model.Filter("ExportDate", sap.ui.model.FilterOperator.LE, sExportDateTo));
//					}
//				}
//				var oShippingDateRangeSelection = that.byId("shippingDateRangeSelection");
//				if (oShippingDateRangeSelection.getSecondDateValue()) {
//					var sShippingDateFrom = oDateFormat.format(oShippingDateRangeSelection.getDateValue());
//					var sShippingDateTo = oDateFormat.format(oShippingDateRangeSelection.getSecondDateValue());
//					if (sShippingDateTo !== null && sShippingDateTo !== "") {
//						array.push(new sap.ui.model.Filter("ShippingDate", sap.ui.model.FilterOperator.GE, sShippingDateFrom));
//						array.push(new sap.ui.model.Filter("ShippingDate", sap.ui.model.FilterOperator.LE, sShippingDateTo));
//					}
//				}
//				var oCreateDateRangeSelection = that.byId("createDateRangeSelection");
//				if (oCreateDateRangeSelection.getSecondDateValue()) {
//					var sCreateDateFrom = oDateFormat.format(oCreateDateRangeSelection.getDateValue());
//					var sCreateDateTo = oDateFormat.format(oCreateDateRangeSelection.getSecondDateValue());
//					if (sCreateDateTo !== null && sCreateDateTo !== "") {
//						array.push(new sap.ui.model.Filter("CreateDate", sap.ui.model.FilterOperator.GE, sCreateDateFrom));
//						array.push(new sap.ui.model.Filter("CreateDate", sap.ui.model.FilterOperator.LE, sCreateDateTo));
//					}
//				}
//				var oDeclarationDateRangeSelection = that.byId("declarationDateRangeSelection");
//				if (oDeclarationDateRangeSelection.getSecondDateValue()) {
//					var sDeclarationDateFrom = oDateFormat.format(oDeclarationDateRangeSelection.getDateValue());
//					var sDeclarationDateTo = oDateFormat.format(oDeclarationDateRangeSelection.getSecondDateValue());
//					if (sDeclarationDateTo !== null && sDeclarationDateTo !== "") {
//						array.push(new sap.ui.model.Filter("DeclarationDate", sap.ui.model.FilterOperator.GE, sDeclarationDateFrom));
//						array.push(new sap.ui.model.Filter("DeclarationDate", sap.ui.model.FilterOperator.LE, sDeclarationDateTo));
//					}
//				}

//				if (sKey === "all") {
//					array.push(
//						new sap.ui.model.Filter([
//							new sap.ui.model.Filter("Status", "EQ", "00"),
//							new sap.ui.model.Filter("Status", "EQ", "10"),
//							new sap.ui.model.Filter("Status", "EQ", "30"),
//							new sap.ui.model.Filter("Status", "EQ", "40"),
//							new sap.ui.model.Filter("Status", "EQ", "50"),
//							new sap.ui.model.Filter("Status", "EQ", "60"),
//							new sap.ui.model.Filter("Status", "EQ", "65"),
//							new sap.ui.model.Filter("Status", "EQ", "70")
//						], false)
//					);
//				} else if (sKey === "10") {
//					array.push(
//						new sap.ui.model.Filter([
//							new sap.ui.model.Filter("Status", "EQ", "00"),
//							new sap.ui.model.Filter("Status", "EQ", "10")
//						], false)
//					);
//				} else {
//					array.push(new sap.ui.model.Filter("Status", "EQ", sKey));
//				}
//				that.getModel().read("/ZCBS_C_DETH/$count", {
//					filters: [new sap.ui.model.Filter(array, true)],
//					groupId: "count",
//					success: function (sCount) {
//						oViewModel.setProperty("/count/" + sKey, sCount);
//					}
//				});
//			}
//			// get count for each DocumentStatusText
//			["all", "10", "30", "40", "50", "60", "65", "70"].forEach(_getCount);
		},

		/**
		 * Binds the view to the object path and expands the aggregated line items.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'master'
		 * @private
		 */
		_onMasterMatched: function(oEvent) {
			var oViewModel = that.getModel("masterView");
			var oArguments = oEvent.getParameter("arguments");
			that._sBusinessType = oArguments.BUSTYPE;
			that._sImpExpIndicator = oArguments.INDEI;
			that.getModel().metadataLoaded().then(function() {
				that.getModel().setSizeLimit(500); // default is 100

				oViewModel.setProperty("/BusinessType", that._sBusinessType);
				oViewModel.setProperty("/ImportOrExport", that._sImpExpIndicator);

				if (that._sBusinessType === "10") {
					oViewModel.setProperty("/RawMaterial", false);
				} else {
					oViewModel.setProperty("/RawMaterial", true);
				}
				if (that._sBusinessType != null && that._sBusinessType !== "") {
					that.getModel().read("/ZCBS_C_DMTEXT", {
						urlParameters: {
							$filter: "DomainName eq 'ZCBS_DM_BUS_TYP' and DomainValue eq '" + that._sBusinessType + "'"
						},
						success: function(oData) {
							oViewModel.setProperty("/BusinessTypeText", oData.results[0] ? oData.results[0].ShortText : that._sBusinessType);
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
						success: function(oData) {
							oViewModel.setProperty("/ImportOrExportText", oData.results[0] ? oData.results[0].ShortText : that._sImpExpIndicator);
						}
					});
				} else {
					oViewModel.setProperty("/ImportOrExportText", "");
				}

				that.getModel().read("/Zcbs_C_Detbizareavh", {
					success: function(oData) {
						if (oData && oData.results && oData.results.length === 1) {
							var sCountry = oData.results[0].CountryKey;
							that.byId("countrySelect").setSelectedKey(sCountry);

							if (sCountry === null || sCountry === "") {
								oViewModel.setProperty("/HKOnly", false);
								oViewModel.setProperty("/NotHK", false);
							} else {
								if (sCountry === "HK") {
									oViewModel.setProperty("/HKOnly", true);
									oViewModel.setProperty("/NotHK", false);
								} else {
									oViewModel.setProperty("/HKOnly", false);
									oViewModel.setProperty("/NotHK", true);
								}
							}
						}

						that.onSearch();

						oViewModel.setProperty("/busy", false);
					}
				});

				var oTable = that.byId("declarationTable");
				var iIndex = that.getModel("appView").getProperty("/selectedIndex");
				var iFirstVisibleRow = that.getModel("appView").getProperty("/firstVisibleRow");
				var aRow = oTable.getBinding("rows");
				if (aRow) {
					aRow.attachDataReceived(function() {
						if (iIndex && iIndex > -1 && iFirstVisibleRow && iFirstVisibleRow > -1) {
							oTable.setFirstVisibleRow(iFirstVisibleRow);
							oTable.setSelectedIndex(iIndex + iFirstVisibleRow);
						}
					});
				}
			});
		},

		_onMetadataLoaded: function() {
			// Store original busy indicator delay for the master view
			var oViewModel = that.getModel("masterView");

			// Make sure busy indicator is displayed immediately when master view is displayed for the first time
			oViewModel.setProperty("/delay", 0);

			// Binding the view will set it to not busy - so the view is always busy if it is not bound
			oViewModel.setProperty("/busy", true);
		},

		/**
		 * Shows the selected item on the master page
		 * On phones a additional history entry is created
		 * @param {sap.m.ObjectListItem} oItem selected Item
		 * @private
		 */
		_showDetail: function(oItem) {
			// set the layout property of FCL control to show two columns
			var oNextUIState = that.getOwnerComponent()
				.getFclHelper()
				.getNextUIState(1);

			that.getRouter().navTo("detail", {
				BUSTYPE: that._sBusinessType,
				INDEI: that._sImpExpIndicator,
				detailId: oItem.getBindingContext().getObject().HeaderID,
				query: {
					layout: oNextUIState.layout
				}
			});
		}
	});

	return masterController;
});
