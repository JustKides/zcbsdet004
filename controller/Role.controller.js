/*global history */
sap.ui.define([
	"huawei/cbs/det004/controller/BaseController",
	"sap/ui/model/json/JSONModel"
], function (BaseController, JSONModel) {
	"use strict";

	return BaseController.extend("huawei.cbs.det004.controller.Role", {
		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the role list controller is instantiated. It sets up the event handling for the master/detail communication and other lifecycle tasks.
		 * @public
		 */
		onInit : function () {
			// Control state model
			var oList = this.byId("list"),
				oViewModel = this._createViewModel(),
				// Put down role list's original value for busy indicator delay,
				// so it can be restored later on. Busy handling on the role list is
				// taken care of by the role list itself.
				iOriginalBusyDelay = oList.getBusyIndicatorDelay();

			this._oList = oList;

			this.setModel(oViewModel, "roleView");
			// Make sure, busy indication is showing immediately so there is no
			// break after the busy indication for loading the view's meta data is
			// ended (see promise 'oWhenMetadataIsLoaded' in AppController)
			oList.attachEventOnce("updateFinished", function(){
				// Restore original busy indicator delay for the list
				oViewModel.setProperty("/delay", iOriginalBusyDelay);
			});

			this.getRouter().getRoute("role").attachPatternMatched(this._onRoleMatched, this);
			this.getRouter().attachBypassed(this.onBypassed, this);
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * After list data is available, this handler method updates the
		 * role list counter and hides the pull to refresh control, if
		 * necessary.
		 * @param {sap.ui.base.Event} oEvent the update finished event
		 * @public
		 */
		onUpdateFinished : function (oEvent) {
			// update the role list object counter after new data is loaded
			this._updateListItemCount(oEvent.getParameter("total"));
		},


		/**
		 * Event handler for the list selection event
		 * @param {sap.ui.base.Event} oEvent the list selectionChange event
		 * @public
		 */
		onSelectionChange : function (oEvent) {
			// get the list item, either from the listItem parameter or from the event's source itself (will depend on the device-dependent mode).
			this._showRole(oEvent.getParameter("listItem") || oEvent.getSource());
		},

		/**
		 * Event handler for the bypassed event, which is fired when no routing pattern matched.
		 * If there was an object selected in the role list, that selection is removed.
		 * @public
		 */
		onBypassed : function () {
			this._oList.removeSelections(true);
		},

		/**
		 * Event handler for navigating back.
		 * We navigate back in the browser history
		 * @public
		 */
		onNavBack : function() {
			history.go(-1);
		},

		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		_createViewModel : function() {
			return new JSONModel({
				isFilterBarVisible: false,
				filterBarLabel: "",
				delay: 0,
				titleCount: 0,
				noDataText: this.getResourceBundle().getText("roleListNoDataText")
			});
		},

		_onRoleMatched : function() {
			// Set the layout property of the FCL control to 'OneColumn'
			this.getModel("appView").setProperty("/uiState/layout", "OneColumn");
		},

		/**
		 * Shows the selected role on the master page
		 * On phones a additional history entry is created
		 * @param {sap.m.ObjectListItem} oItem selected Item
		 * @private
		 */
		_showRole : function (oItem) {
			// set the layout property of FCL control to show two columns
			var sBusinessType = oItem.getBindingContext().getProperty("BusinessType");
			var sImpExpIndicator = oItem.getBindingContext().getProperty("ImpExpIndicator");

			this.getModel("appView").setProperty("/businessType", sBusinessType);
			this.getModel("appView").setProperty("/impExpIndicator", sImpExpIndicator);

			this.getModel("appView").setProperty("/uiState/layout", "OneColumn");
			this.getRouter().navTo("master", {
				BUSTYPE : sBusinessType,
				INDEI : sImpExpIndicator
			});
		},

		/**
		 * Sets the item count on the role list header
		 * @param {int} iTotalItems the total number of items in the list
		 * @private
		 */
		_updateListItemCount : function (iTotalItems) {
			// only update the counter if the length is final
			if (this._oList.getBinding("items").isLengthFinal()) {
				this.getModel("roleView").setProperty("/titleCount", iTotalItems);
			}
		}
	});
});
