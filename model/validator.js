sap.ui.define([
], function () {
	"use strict";

	return {
		validateItemMandatory: function(sObject) {
			var bValidationError = false;

			if (!sObject || sObject === "null" || sObject === "undefined" || sObject.length === 0) {
				bValidationError = true;
			}

			return bValidationError;
		},

		validateText: function(oObject) {
			var bValidationError = false;

			if (!oObject.text || oObject.text.length === 0) {
				bValidationError = true;
				sap.ui.getCore().getMessageManager().addMessages(
					new sap.ui.core.message.Message({
						message: oObject.label + " should not be empty!",
						type: sap.ui.core.MessageType.Error
					})
				);
			}

			return bValidationError;
		},

		validateInput: function(oObject) {
			var sValueState = "None";
			var bValidationError = false;

			if (oObject.control && oObject.control.getValue().length === 0) {
				sValueState = "Error";
				bValidationError = true;
				sap.ui.getCore().getMessageManager().addMessages(
					new sap.ui.core.message.Message({
						message: oObject.label + " should not be empty!",
						type: sap.ui.core.MessageType.Error
					})
				);
			}

			if (oObject.control) {
				oObject.control.setValueState(sValueState);
			}
			return bValidationError;
		},

		validateSelect: function(oObject) {
			var sValueState = "None";
			var bValidationError = false;

			if (oObject.control && oObject.control.getSelectedItem() === null) {
				sValueState = "Error";
				bValidationError = true;
				sap.ui.getCore().getMessageManager().addMessages(
					new sap.ui.core.message.Message({
						message: oObject.label + " should not be empty!",
						type: sap.ui.core.MessageType.Error
					})
				);
			}

			if (oObject.control) {
				oObject.control.setValueState(sValueState);
			}
			return bValidationError;
		},

		validateNumber: function(oObject) {
			var sValueState = "None";
			var bValidationError = false;

			if (oObject.control) {
				var oBinding = oObject.control.getBinding("value");
				try {
					oBinding.getType().validateValue(oObject.control.getValue());
				} catch (oException) {
					sValueState = "Error";
					bValidationError = true;
					sap.ui.getCore().getMessageManager().addMessages(
						new sap.ui.core.message.Message({
							message: oException.message,
							type: sap.ui.core.MessageType.Error
						})
					);
				}
			}

			if (oObject.control) {
				oObject.control.setValueState(sValueState);
			}
			return bValidationError;
		},

		validateSmartField: function(oObject) {
			// var sValueState = "None";
			var bValidationError = false;

			if (oObject.control) {
				var aChildren = oObject.control.getInnerControls();
				var len = aChildren.length;
				for (var i = 0; i < len; i++) {
					var oChild = aChildren[i];
					if (oChild.getValueState && oChild.getValueState() === "Error") {
						// sValueState = "Error";
						bValidationError = true;
						if (oChild.getValueStateText() && oChild.getValueStateText().length > 0) {
							sap.ui.getCore().getMessageManager().addMessages(
								new sap.ui.core.message.Message({
									message: oChild.getValueStateText(),
									type: sap.ui.core.MessageType.Error
								})
							);
						}
						// oChild.setValueState(sValueState);
					}
				}
			}
			return bValidationError;
		},

		validatePort: function(oSelect, oInput) {
			var sValueState = "None";
			var bValidationError1 = false;
			var bValidationError2 = false;

			if (oSelect.control && oSelect.control.getValue().length === 0) {
				bValidationError1 = true;
			}

			if (oInput.control && oInput.control.getValue().length === 0) {
				bValidationError2 = true;
			}

			if (bValidationError1 && bValidationError2) {
				sValueState = "Error";
				sap.ui.getCore().getMessageManager().addMessages(
					new sap.ui.core.message.Message({
						message: oSelect.label + " should not be empty!",
						type: sap.ui.core.MessageType.Error
					})
				);
				if (oSelect.control) {
					oSelect.control.setValueState(sValueState);
				}
				if (oInput.control) {
					oInput.control.setValueState(sValueState);
				}
			} else {
				sValueState = "None";
				oSelect.control.setValueState(sValueState);
				oInput.control.setValueState(sValueState);
			}

			return bValidationError1 && bValidationError2;
		}
	};
});
