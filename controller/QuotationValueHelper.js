sap.ui.define([
	"sap/ui/base/Object",
	"sap/ui/comp/valuehelpdialog/ValueHelpDialog",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function(
	Object,
	ValueHelpDialog,
	Filter,
	FilterOperator
) {
	"use strict";

	return Object.extend("huawei.cbs.det004.controller.QuotationValueHelper", {
		aKeys : [],
		theInput : null,
		cols : [],
		config : null,
		fields : [],
		oColModel : new sap.ui.model.json.JSONModel(),
		model : null,
		filter : [],
		binding : null,
		title : "",
		search : "",
		constructor : function(model, inputField, config, title) {
			this.theInput = inputField;
			this.config = config;
			this.title = title;
			this.model = model;
			// $.extend({}, model);
		},
		clearValueHelp : function() {
			this.theInput.setValue("");
		},
		openValueHelp : function(binding, onOk, onCancel, scope) {
			var me = this;

			this.binding = binding;

			me.aKeys = [];
			me.cols = [];
			me.fields = [];
			me.filter = [];

			jQuery.each(this.config, function(key, value) {
				if (value.search) {
					me.search = value.key;
				}
				if (value.iskey && value.iskey === true) {
					me.aKeys.push(value.key);
				}
				var col = {};
				col.label = value.label;
				col.template = value.key; // new sap.m.Text();
				if (value.format === "Date") {
					col.oType = new sap.ui.model.type.Date(); // {source: {pattern: "yyyyMMdd"}, pattern: "dd-MM-YYYY"}
				}
				if (value.width) {
					col.width = value.width;
				}
				me.cols.push(col);
				me.fields.push({
					label : value.label,
					key : value.key
				});
				if (value.searchable) {
					me.filter.push(new sap.ui.comp.filterbar.FilterGroupItem({
						groupTitle : "Group",
						groupName : "gn1",
						name : value.key,
						label : value.label,
						control : new sap.m.Input(value.key)
					}));
				}
			});
			this.oColModel.setData({
				cols : this.cols
			});

			var oValueHelpDialog = new ValueHelpDialog({
				basicSearchText : me.theInput.getValue(),
				title : me.title,
				modal : true,
				supportMultiselect : false,
				supportRanges : false,
				supportRangesOnly : false,
				key : me.aKeys[1],
				descriptionKey : me.aKeys[0],
				ok : function(oControlEvent) {
					var aValue = oControlEvent.getParameter("tokens")[0].getCustomData()[0].mProperties.value;
					me.theInput.setValue(aValue.Quotation);
					oValueHelpDialog.close();
					onOk.call(scope || this, aValue, scope);
				},
				cancel : function(oControlEvent) {
					oValueHelpDialog.close();
					onCancel.call(scope || this, scope);
				},
				afterClose : function() {
					oValueHelpDialog.destroy();
				}
			});
			oValueHelpDialog.getTable().setModel(me.oColModel, "columns");
			oValueHelpDialog.getTable().setModel(me.model);
			oValueHelpDialog.getTable().bindRows({
				path : me.binding
			});

			oValueHelpDialog.getTable().getModel().attachRequestSent(function() {
				if (oValueHelpDialog && oValueHelpDialog.getTable()) {
					oValueHelpDialog.getTable().setBusy(true);
				}
			});
			oValueHelpDialog.getTable().getModel().attachRequestCompleted(function() {
				if (oValueHelpDialog && oValueHelpDialog.getTable()) {
					oValueHelpDialog.getTable().setBusy(false);
				}
			});

			oValueHelpDialog.setRangeKeyFields(me.fields);

			var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
				advancedMode : true,
				filterItems : [],
				filterGroupItems : [ me.filter ],
				search : function(search) {
					var filters = [];
					jQuery.each(arguments[0].getParameter("selectionSet"), function(key, value) {
						if (value.getValue()) {
							var splitTab = value.getId().split("_");
							if (splitTab.length === 2) {
								filters.push(new Filter(splitTab[0], FilterOperator.Contains, value.getValue()));
							} else {
								filters.push(new Filter(value.getId(), FilterOperator.Contains, value.getValue()));
							}
						}
					});
					oValueHelpDialog.getTable().bindRows({
						path : me.binding,
						filters : filters
					});
				}
			});

			if (oFilterBar.setBasicSearch) {
				oFilterBar.setBasicSearch(new sap.m.SearchField({
					id: "s1",
					showSearchButton: true,
					placeholder: "Search quotation",
					search: function(param1) {
						var filters = [];
						if (param1.getParameter("query") && param1.getParameter("query").length > 0) {
							filters.push(new Filter(me.search, FilterOperator.Contains, param1.getParameter("query")));
						}
						oValueHelpDialog.getTable().getBinding().filter(filters);
					}
				}));
			}

			oValueHelpDialog.setFilterBar(oFilterBar);

			if (this.theInput.$().closest(".sapUiSizeCompact").length > 0) {
				// check if the Token field runs in Compact mode
				oValueHelpDialog.addStyleClass("sapUiSizeCompact");
			}
			oValueHelpDialog.open();
			oValueHelpDialog.update();
		}
	});
});
