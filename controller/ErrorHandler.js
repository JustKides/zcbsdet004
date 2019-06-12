sap.ui.define([
	"sap/ui/base/Object",
	"sap/m/MessageBox"
], function (UI5Object, MessageBox) {
	"use strict";

	return UI5Object.extend("huawei.cbs.det004.controller.ErrorHandler", {
		/**
		 * Handles application errors by automatically attaching to the model events and displaying errors when needed.
		 * @class
		 * @param {sap.ui.core.UIComponent} oComponent reference to the app's component
		 * @public
		 * @alias huawei.cbs.det004.controller.ErrorHandler
		 */
		constructor : function (oComponent) {
			this._oResourceBundle = oComponent.getModel("i18n").getResourceBundle();
			this._oComponent = oComponent;
			this._oModel = oComponent.getModel();
			this._bMessageOpen = false;
			this._sErrorText = this._oResourceBundle.getText("errorText");

			this._oModel.attachMetadataFailed(function (oEvent) {
				var oParams = oEvent.getParameters();
				this._showServiceError(oParams.response);
			}, this);

			this._oModel.attachRequestFailed(function (oEvent) {
				var oParams = oEvent.getParameters();
				// An entity that was not found in the service is also throwing a 404 error in oData.
				// We already cover this case with a notFound target so we skip it here.
				// A request that cannot be sent to the server is a technical error that we have to handle though

				var iStatusCode = +oParams.response.statusCode;
				switch (iStatusCode) {
					case 404:
						if (oParams.response.responseText.indexOf("Cannot POST") === 0) {
							this._showServiceError(oParams.response);
						}
						break;
					case 409:
						var oResponseText = JSON.parse(oParams.response.responseText);
						var sDetails = "User Error: " + oResponseText.error.message.value + " (" + oResponseText.error.code + ")";
						var sErrorText = oResponseText.error.message.value;
						var sErrorTitle = "User Error";
						this._showServiceError(sDetails, sErrorText, sErrorTitle);
						break;
					default:
						this._showServiceError(oParams.response);
						break;
				}

				// if (oParams.response.statusCode !== "404" || (oParams.response.statusCode === 404 && oParams.response.responseText.indexOf("Cannot POST") === 0)) {
				// 	this._showServiceError(oParams.response);
				// }
			}, this);
		},

		/**
		 * Shows a {@link sap.m.MessageBox} when a service call has failed.
		 * Only the first error message will be display.
		 * @param {string} sDetails a technical error to be displayed on request
		 * @private
		 */
		_showServiceError : function (sDetails, sErrorText, sErrorTitle) {
			if (this._bMessageOpen) {
				return;
			}
			this._bMessageOpen = true;
			MessageBox.error(
				sErrorText || this._sErrorText,
				{
					id : "serviceErrorMessageBox",
					title: sErrorTitle || "Error",
					details : sDetails,
					styleClass : this._oComponent.getContentDensityClass(),
					actions : [MessageBox.Action.CLOSE],
					onClose : function () {
						this._bMessageOpen = false;
					}.bind(this)
				}
			);
		}
	});
});