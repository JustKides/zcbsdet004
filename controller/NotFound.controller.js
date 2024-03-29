sap.ui.define([
	"huawei/cbs/det004/controller/BaseController"
], function (BaseController) {
	"use strict";

	return BaseController.extend("huawei.cbs.det004.controller.NotFound", {
		onInit: function () {
			this.getRouter().getTarget("notFound").attachDisplay(this._onNotFoundDisplayed, this);
		},

		_onNotFoundDisplayed : function () {
			this.getModel("appView").setProperty("/layout", "OneColumn");
		}
	});
});
