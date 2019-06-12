/*global history */
sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/Device",
	"sap/m/Button",
	"sap/ui/core/routing/History",
	"sap/ui/model/odata/ODataUtils"
], function (Controller, Device, Button, History, ODataUtils) {
	"use strict";

	return Controller.extend("huawei.cbs.det004.controller.BaseController", {
		/**
		 * Convenience method for accessing the router in every controller of the application.
		 * @public
		 * @returns {sap.ui.core.routing.Router} the router for this component
		 */
		getRouter : function () {
			return this.getOwnerComponent().getRouter();
		},

		/**
		 * Convenience method for getting the view model by name in every controller of the application.
		 * @public
		 * @param {string} sName the model name
		 * @returns {sap.ui.model.Model} the model instance
		 */
		getModel : function (sName) {
			var that = this;
			if (!sName) { // oDataModel
				// hack odatamodel to ensure generate key by guid
				var xModel = this.getView().getModel(sName);
				xModel.createEntry = function(sPath, mParameters) {
					var fnSuccess, fnError, oRequest, sUrl, sETag, oContext,
					sKey, aUrlParams, sGroupId, sChangeSetId, bRefreshAfterChange,
					mUrlParams, mHeaders, mRequests, vProperties, oEntity = {},
					fnCreated,
					sMethod = "POST";

					if (mParameters) {
						vProperties = mParameters.properties;
						sGroupId = mParameters.groupId || mParameters.batchGroupId;
						sChangeSetId = mParameters.changeSetId;
						oContext  = mParameters.context;
						fnSuccess = mParameters.success;
						fnError   = mParameters.error;
						fnCreated = mParameters.created;
						sETag     = mParameters.eTag;
						mHeaders  = mParameters.headers;
						mUrlParams = mParameters.urlParameters;
						bRefreshAfterChange = mParameters.refreshAfterChange;
					}
					bRefreshAfterChange = xModel._getRefreshAfterChange(bRefreshAfterChange, sGroupId);

					sGroupId = sGroupId ? sGroupId : xModel.sDefaultChangeGroup;
					aUrlParams = ODataUtils._createUrlParamsArray(mUrlParams);
					mHeaders = xModel._getHeaders(mHeaders);

					var oRequestHandle = {
						abort: function() {
							if (oRequest) {
								oRequest._aborted = true;
							}
						}
					};

					function create() {
						var oCreatedContext;
						if (!jQuery.sap.startsWith(sPath, "/")) {
							sPath = "/" + sPath;
						}
						var oEntityMetadata = xModel.oMetadata._getEntityTypeByPath(sPath);
						if (!oEntityMetadata) {

							jQuery.sap.assert(oEntityMetadata, "No Metadata for collection " + sPath + " found");
							return undefined;
						}
						if (typeof vProperties === "object" && !Array.isArray(vProperties)) {
							oEntity = vProperties;
						} else {
							for (var i = 0; i < oEntityMetadata.property.length; i++) {
								var oPropertyMetadata = oEntityMetadata.property[i];

								var bPropertyInArray = jQuery.inArray(oPropertyMetadata.name,vProperties) > -1;
								if (!vProperties || bPropertyInArray)  {
									oEntity[oPropertyMetadata.name] = xModel._createPropertyValue(oPropertyMetadata.type);
									if (bPropertyInArray) {
										vProperties.splice(vProperties.indexOf(oPropertyMetadata.name),1);
									}
								}
							}
							if (vProperties) {
								jQuery.sap.assert(vProperties.length === 0, "No metadata for the following properties found: " + vProperties.join(","));
							}
						}
						//get EntitySet metadata for data storage
						var oEntitySetMetadata = xModel.oMetadata._getEntitySetByType(oEntityMetadata);
						sKey = oEntitySetMetadata.name + "(guid'" + that.guid() + "')";

						oEntity.__metadata = {type: "" + oEntityMetadata.entityType, uri: xModel.sServiceUrl + '/' + sKey, created: {
							//store path for later POST
							key: sPath.substring(1),
							success: fnSuccess,
							error: fnError,
							headers: mHeaders,
							urlParameters: mUrlParams,
							groupId: sGroupId,
							changeSetId: sChangeSetId,
							eTag: sETag}};

						xModel._addEntity(jQuery.sap.extend(true, {}, oEntity));
						xModel.mChangedEntities[sKey] = oEntity;

						sUrl = xModel._createRequestUrl(sPath, oContext, aUrlParams, xModel.bUseBatch);
						oRequest = xModel._createRequest(sUrl, sMethod, mHeaders, oEntity, sETag);

						oCreatedContext = xModel.getContext("/" + sKey); // context wants a path
						oCreatedContext.bCreated = true;

						oRequest.key = sKey;
						oRequest.created = true;

						mRequests = xModel.mRequests;
						if (sGroupId in xModel.mDeferredGroups) {
							mRequests = xModel.mDeferredRequests;
						}

						xModel.oMetadata.loaded().then(function() {
							xModel._pushToRequestQueue(mRequests, sGroupId,
								sChangeSetId, oRequest, fnSuccess, fnError, oRequestHandle, bRefreshAfterChange);
							xModel._processRequestQueueAsync(xModel.mRequests);
						});
						return oCreatedContext;
					}

					// If no callback function is provided context must be returned synchronously
					if (fnCreated) {
						xModel.oMetadata.loaded().then(function() {
							fnCreated(create());
						});
					} else if (xModel.oMetadata.isLoaded()) {
						return create();
					} else {
						jQuery.sap.log.error("Tried to use createEntry without created-callback, before metadata is available!");
					}
				};
				return xModel;
			}
			return this.getView().getModel(sName);
		},

		/**
		 * Convenience method for setting the view model in every controller of the application.
		 * @public
		 * @param {sap.ui.model.Model} oModel the model instance
		 * @param {string} sName the model name
		 * @returns {sap.ui.mvc.View} the view instance
		 */
		setModel : function (oModel, sName) {
			return this.getView().setModel(oModel, sName);
		},

		/**
		 * Convenience method for getting the resource bundle.
		 * @public
		 * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
		 */
		getResourceBundle : function () {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle();
		},

		/**
		 * Getter for the doc types.
		 * 
		 * @public
		 * @returns {sap.ui.model.json.JSONModel} the doc typs of the component
		 */
		getDocTypes: function() {
			return this.getOwnerComponent().getModel("docTypes");
		},

		/**
		 * Getter for the select options.
		 * 
		 * @public
		 * @returns {sap.ui.model.json.JSONModel} the select options of the component
		 */
		getSelectOptions: function() {
			return this.getOwnerComponent().getModel("selectOptions");
		},

		/**
		 * Getter for the HK Companies.
		 * 
		 * @public
		 * @returns {sap.ui.model.json.JSONModel} the HK Companies of the component
		 */
		getHkCompanies: function() {
			return this.getOwnerComponent().getModel("hkCompanies");
		},

		/**
		 * Event handler for navigating back.
		 * It there is a history entry we go one step back in the browser history
		 * If not, it will replace the current entry of the browser history with the master route.
		 * @public
		 */
		onNavBack : function() {
			var sPreviousHash = History.getInstance().getPreviousHash();
			if (sPreviousHash !== undefined) {
				history.go(-1);
			} else {
				this.getRouter().navTo("role", {}, true);
			}
		},

		/**
		 * Enhanced navTo methods
		 * @public
		 * @param {String} sRoute Target route name, if not given, old route will be used
		 * @param {Object} mParam Target route parameters
		 * @param {Boolean} bReplace If replace history, default value depends on device if not given
		 */
		navTo: function (sRoute, mParam, bReplace) {
			var oViewModel = this.getModel("appView");
			var oRouter = this.getOwnerComponent().getRouter(),
				sOldRoute = oViewModel.getProperty("/routeName"),
				oRouteArg = oViewModel.getProperty("/routeArg");

			function _nav() {
				sRoute = sRoute || sOldRoute || "role";
				bReplace = bReplace === undefined ? !Device.system.phone : bReplace;
				mParam = jQuery.extend({}, oRouteArg, mParam);
				// route
				oRouter.navTo(sRoute, mParam, bReplace);
			}

			// publish an event for create or detail
			if (sRoute && (sOldRoute === "create" || sOldRoute === "detail") &&
				mParam && oRouteArg.detailId !== mParam.detailId) {
				sap.ui.getCore().getEventBus().publish(sOldRoute, "discard", {
					callback: _nav
				});
			} else {
				_nav();
			}
		},

		/**
		 * Toggle between full and non full screen mode.
		 */
		toggleFullScreen: function(oEvent) {
			var sLayout = oEvent.getSource().getBindingContext("appView").getProperty();
			this.navTo(null, {
				query: {
					layout: sLayout
				}
			});
		},

		addSelectClearButton: function(oObject) {
			oObject.control.removeAllButtons();
			oObject.control.addButton(
				new Button({
					text: this.getResourceBundle().getText("buttonTextClear"),
					press: function() {
						oObject.control.close().setSelectedKey("");
						if (oObject.callback) {
							oObject.callback();
						}
					}
				})
			);
		},

		registerToMessageManager: function(oObject) {
			if (oObject.control) {
				sap.ui.getCore().getMessageManager().registerObject(oObject.control, true);
			}
		},

		unregisterToMessageManager: function(oObject) {
			if (oObject.control) {
				oObject.control.setValueState(sap.ui.core.ValueState.None);
				sap.ui.getCore().getMessageManager().unregisterObject(oObject.control);
			}
		},

		guid : function() {
			function s4() {
				return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
			}
			// return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
			return "ffffffff-" + s4() + "-" + s4() + "-" + s4() + "-" + s4() + s4() + s4();
		},

		sanitizeGuid : function(guid) {
			if (guid) {
				var result = guid.replace(/-/gi, "").toUpperCase();
				return result;
			} else {
				return null;
			}
		},

		onInnerControlsCreated: function(oEvent) {
			var aInnerInput = oEvent.getSource().getInnerControls();
			if (aInnerInput && aInnerInput.length >= 0) {
				var oInnerInput = aInnerInput[0];
				if (oInnerInput) {
					var sId = oInnerInput.sId;
					if (sId.indexOf("itemCodeInput-input") >= 0) {
						oInnerInput.attachValueHelpRequest(function() {
							function waitForItemValueHelpToDisplay(id, time) {
								if (sap.ui.getCore().byId(id) != null) {
									// sap.ui.getCore().byId(sId + "-valueHelpDialog-smartFilterBar-filterItemControlA_-ItemCodeID").setEditable(false);
									sap.ui.getCore().byId(sId + "-valueHelpDialog-smartFilterBar-filterItem-Zcbs_C_ItemcodeType-ItemCodeID").setVisible(false);
									sap.ui.getCore().byId(sId + "-valueHelpDialog-smartFilterBar-filterItemControlA_-ItemCodeID").setVisible(false);
									return;
								} else {
									setTimeout(function() {
										waitForItemValueHelpToDisplay(id, time);
									}, time);
								}
							}
							waitForItemValueHelpToDisplay(sId + "-valueHelpDialog-smartFilterBar-filterItemControlA_-ItemCodeID", 500);
						});
					}
					if (sId.indexOf("hsCodeInput-input") >= 0) {
						oInnerInput.attachValueHelpRequest(function() {
							function waitForHsCodeValueHelpToDisplay(id, time) {
								if (sap.ui.getCore().byId(id) != null) {
									sap.ui.getCore().byId(sId + "-valueHelpDialog-smartFilterBar-filterItemControlA_-HSCodeID").setEditable(false);
									sap.ui.getCore().byId(sId + "-valueHelpDialog-smartFilterBar-filterItemControlA_-NumberScheme").setEditable(false);
									sap.ui.getCore().byId(sId + "-valueHelpDialog-smartFilterBar-filterItemControlA_-BOEUnit").setValueHelpOnly(true);
									return;
								} else {
									setTimeout(function() {
										waitForHsCodeValueHelpToDisplay(id, time);
									}, time);
								}
							}
							waitForHsCodeValueHelpToDisplay(sId + "-valueHelpDialog-smartFilterBar-filterItemControlA_-NumberScheme", 500);
						});
					}
					if (sId.indexOf("PortSelect-input") >= 0 || sId.indexOf("finalDestinationSelect-input" >= 0)) {
						oInnerInput.attachValueHelpRequest(function() {
							function waitForPortValueHelpToDisplay(id, time) {
								if (sap.ui.getCore().byId(id) != null) {
									sap.ui.getCore().byId(sId + "-valueHelpDialog-smartFilterBar-filterItemControlA_-Country").setEditable(false);
									return;
								} else {
									setTimeout(function() {
										waitForPortValueHelpToDisplay(id, time);
									}, time);
								}
							}
							waitForPortValueHelpToDisplay(sId + "-valueHelpDialog-smartFilterBar-filterItemControlA_-Country", 500);
						});
					}
					oInnerInput.setValueHelpOnly(true);
				}
				var oUnitInput = aInnerInput[1];
				if (oUnitInput) {
					var sUnitId = oUnitInput.sId;
					if (sUnitId.indexOf("qtyInput-sfEdit-input") >= 0) {
						oUnitInput.attachValueHelpRequest(function() {
							function waitForUnitHelpToDisplay(id, time) {
								if (sap.ui.getCore().byId(id) != null) {
									sap.ui.getCore().byId(sUnitId + "-valueHelpDialog-smartFilterBar-filterItemControlA_-Unit").setValueHelpOnly(true);
									return;
								} else {
									setTimeout(function() {
										waitForUnitHelpToDisplay(id, time);
									}, time);
								}
							}
							waitForUnitHelpToDisplay(sUnitId + "-valueHelpDialog-smartFilterBar-filterItemControlA_-Unit", 500);
						});
					}
				}
			}
		},

		onPartnerInnerControlsCreated: function(oEvent) {
			var aInnerInput = oEvent.getSource().getInnerControls();
			if (aInnerInput && aInnerInput.length >= 0) {
				var oInnerInput = aInnerInput[0];
				if (oInnerInput) {
					var sId = oInnerInput.sId;
					oInnerInput.attachValueHelpRequest(function() {
						function waitForPortValueHelpToDisplay(id, time) {
							if (sap.ui.getCore().byId(id) != null) {
								sap.ui.getCore().byId(sId + "-valueHelpDialog-smartFilterBar-filterItemControlA_-Partner_Guid").setEditable(false);
								return;
							} else {
								setTimeout(function() {
									waitForPortValueHelpToDisplay(id, time);
								}, time);
							}
						}
						waitForPortValueHelpToDisplay(sId + "-valueHelpDialog-smartFilterBar-filterItemControlA_-Partner_Guid", 500);
					});
					oInnerInput.setValueHelpOnly(true);
				}
			}
		},

		getUserInfo: function() {
			var oUserData = null;
			var userService = "/sap/bc/ui2/start_up";
			var httpRequest = new XMLHttpRequest();
			httpRequest.onreadystatechange = function() {
				if (httpRequest.readyState === 4 && httpRequest.status === 200) {
					oUserData = JSON.parse(httpRequest.responseText);
				}
			};
			httpRequest.open("GET", userService, false);
			httpRequest.send(null);
			return oUserData;
		}
	});
});
