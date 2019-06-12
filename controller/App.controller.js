sap.ui.define([
	"huawei/cbs/det004/controller/BaseController",
	"sap/ui/model/json/JSONModel"
], function (BaseController, JSONModel) {
	"use strict";

	var appController = BaseController.extend("huawei.cbs.det004.controller.App", {
		onInit : function () {
			jQuery.sap.log.setLevel(jQuery.sap.log.Level.ERROR);

			var that = this,
				oViewModel,
				fnSetAppNotBusy,
				iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();

			oViewModel = new JSONModel({
				busy : true,
				delay : 0,
				impExpIndicator : "",
				businessLine : "",
				previousLayout : "",
				uiState: {}
			});
			this.setModel(oViewModel, "appView");

			var oUiModel = new JSONModel();
			oUiModel.setDefaultBindingMode(sap.ui.model.BindingMode.TwoWay);
			this.setModel(oUiModel, "uiView");

			fnSetAppNotBusy = function() {
				oViewModel.setProperty("/busy", false);
				oViewModel.setProperty("/delay", iOriginalBusyDelay);
			};

			this.getOwnerComponent().getModel().metadataLoaded().then(fnSetAppNotBusy);
			this.getOwnerComponent().getModel().attachMetadataFailed(fnSetAppNotBusy);

			// apply content density mode to root view
			this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());

			// router and flc layout
			this.getRouter().attachRouteMatched(this.onRouteMatched, this);
			// hack fcl layout setter
			this.getView().byId("app").setLayout = function(newLayout) {
				if (newLayout !== "null") {
					if (this.getLayout() !== newLayout) {
						// if layout has changed, try sync ui state
						sap.f.FlexibleColumnLayout.prototype.setLayout.apply(this, arguments);
						that._syncUiState();
					} else {
						sap.f.FlexibleColumnLayout.prototype.setLayout.apply(this, arguments);
					}
				}
			};
		},

		onAfterRendering: function() {
			this._syncUiState();
		},

		_syncUiState: function() {
			var oViewModel = this.getModel("appView");
			// sync ui state lazily and update layout only for the last state change
			if (this._synFlag) {
				// if flag exsits, clear it
				clearTimeout(this._synFlag);
			}
			// create new flag
			this._synFlag = setTimeout(function() {
				this._synFlag = null;
				var oUIState = this.getOwnerComponent().getFclHelper().getCurrentUIState();
				oViewModel.setProperty("/uiState", oUIState);
			}.bind(this));
		},

		onStateChanged: function(oEvent) {
			if (oEvent.getParameter("isNavigationArrow")) {
				this.navTo(null, {
					query: {
						layout: oEvent.getSource().getLayout()
					}
				});
			}
		},

		onRouteMatched: function(oEvent) {
			var oViewModel = this.getModel("appView");
			var oUiModel = this.getModel("uiView");
			var currentRouteName = oEvent.getParameter("name");
			var currentRouteArg = jQuery.extend({}, oEvent.getParameter("arguments"));
			oViewModel.setProperty("/routeName", currentRouteName);
			oViewModel.setProperty("/routeArg", currentRouteArg);

			// trigger layout change
			if (currentRouteArg["?query"] && currentRouteArg["?query"].layout) {
				var newLayout = currentRouteArg["?query"].layout;
				oViewModel.setProperty("/uiState/layout", newLayout);
			}

			this.getModel("ui").metadataLoaded().then(function() {
				this.getModel("ui").read("/Zcbs_C_Uicontrol", {
					filters: [ new sap.ui.model.Filter("AppID", sap.ui.model.FilterOperator.EQ, "DET_MGT") ],
					success: function (oData) {
						for (var i in oData.results) {
							var element = oData.results[i];
							oUiModel.setProperty("/" + element.ElementID, element.Visible);
						}
					}
				});
			}.bind(this));
		}
	});

	return appController;
});
