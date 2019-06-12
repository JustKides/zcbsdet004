sap.ui.define([
	"sap/ui/model/type/Currency",
	"sap/ui/core/format/DateFormat"
], function (Currency, DateFormat) {
	"use strict";

	return {
		/**
		 * Format the value to percentage
		 *
		 * @public
		 * @param {string} sValue value to be formatted
		 * @returns {string} formatted percentage value
		 */
		percentValue: function (sValue) {
			if (!sValue) {
				return "";
			}
			var percentFormat = sap.ui.core.format.NumberFormat.getPercentInstance({
				minFractionDigits: 2,
				maxFractionDigits: 2
			});
			var fValue = percentFormat.format(Number(sValue));
			return fValue;
		},

		calculateAmountDifference: function (fSystemAmount, fActualAmount, sCurrencyCode) {
			if (fSystemAmount && fActualAmount) {
				var oCurrency = new Currency({
					showMeasure: false
				});
				var fTotal = Number(fActualAmount) - Number(fSystemAmount);
				return oCurrency.formatValue([fTotal.toFixed(2), sCurrencyCode], "string");
			} else {
				return "";
			}
		},

		calculateAmountDifferenceState: function (fSystemAmount, fActualAmount) {
			if (fSystemAmount && fActualAmount) {
				var fTotal = Math.abs(Number(fSystemAmount) - Number(fActualAmount));
				if (fTotal === 0) {
					return "Success";
				} else {
					return "Error";
				}
			} else {
				return "Error";
			}
		},

		/**
		 * Converts a binary string into an image format suitable for the src attribute
		 *
		 * @public
		 * @param {string} vData a binary string representing the image data
		 * @returns {string} formatted string with image metadata based on the input or a default image when the input is empty
		 */
		handleBinaryContent: function(vData) {
			if (vData) {
				var sMetaData1 = "data:image/jpeg;base64,";
				var sMetaData2 = vData.substr(104); // stripping the first 104 bytes from the binary data when using base64 encoding.
				return sMetaData1 + sMetaData2;
			} else {
				return "../images/Employee.png";
			}
		},

		packageQtyFormatter: function(qty, type) {
			if (qty) {
				if (qty === 0 && type === 'Ditto') {
					return null;
				} else {
					return parseFloat(qty);
				}
			} else {
				return null;
			}
		},

		dateTimeFormatter: function(sDate) {
			if (sDate) {
				var pDateFormat = DateFormat.getDateTimeInstance({
					// pattern: "yyyyMMddHHmmss",
					pattern: "yyyyMMdd",
					UTC: true
				});
				var fDateFormat = DateFormat.getDateInstance({
					style: "medium",
					UTC: true
				});
				return fDateFormat.format(pDateFormat.parse(sDate));
			}
			return sDate;
		},

		statusTextFormatter: function(sStatus) {
			var sStatusText = sStatus + "";
			switch (sStatusText) {
			case "00":
				sStatusText = "Draft"; // Initial
				break;
			case "10":
				sStatusText = "Draft";
				break;
			case "20":
				sStatusText = "Block";
				break;
			case "30":
				sStatusText = "Submitted";
				break;
			case "40":
				sStatusText = "Approved";
				break;
			case "50":
				sStatusText = "Declared";
				break;
			case "60":
				sStatusText = "To Be Accepted";
				break;
			case "65":
				sStatusText = "Partially Accepted";
				break;
			case "70":
				sStatusText = "Accepted";
				break;
			case "80":
				sStatusText = "Archived";
				break;
			case "99":
				sStatusText = "Cancelled";
				break;
			default:
				sStatusText = "";
				break;
			}
			return sStatusText;
		}
	};
});
