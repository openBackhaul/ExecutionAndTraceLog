const ForwardingConstructAutomationInput = require('onf-core-model-ap/applicationPattern/onfModel/services/models/forwardingConstruct/AutomationInput');
const TcpServerInterface = require('onf-core-model-ap/applicationPattern/onfModel/models/layerProtocols/TcpServerInterface');
const onfFormatter = require('onf-core-model-ap/applicationPattern/onfModel/utility/OnfAttributeFormatter');
const HttpServerInterface = require('onf-core-model-ap/applicationPattern/onfModel/models/layerProtocols/HttpServerInterface');
const ForwardingDomain = require('onf-core-model-ap/applicationPattern/onfModel/models/ForwardingDomain');
const FcPort = require('onf-core-model-ap/applicationPattern/onfModel/models/FcPort');

exports.regardApplication = function (applicationLayerTopologyForwardingInputList, applicationName, releaseNumber) {
    return new Promise(async function (resolve, reject) {
        let forwardingConstructAutomationList = [];
        try {
            /********************************************************************************************************
             * NewApplicationCausesRequestForredirectServiceRequestApprovals /v1/redirect-service-request-information
             ********************************************************************************************************/
            let redirectServiceRequestForwardingName = "ApprovedApplicationCausesRequestForServiceRequestInformation";
            let redirectServiceRequestContext = applicationName + releaseNumber;
            let redirectServiceRequestRequestBody = {};
            redirectServiceRequestRequestBody.serviceLogApplication = await HttpServerInterface.getApplicationNameAsync();
            redirectServiceRequestRequestBody.serviceLogApplicationReleaseNumber = await HttpServerInterface.getReleaseNumberAsync();
            redirectServiceRequestRequestBody.serviceLogOperation = await getOperationClientToLogServiceRequestAsync();
            redirectServiceRequestRequestBody.serviceLogAddress = await TcpServerInterface.getLocalAddress();
            redirectServiceRequestRequestBody.serviceLogPort = await TcpServerInterface.getLocalPort();
            redirectServiceRequestRequestBody = onfFormatter.modifyJsonObjectKeysToKebabCase(redirectServiceRequestRequestBody);
            let forwardingAutomation = new ForwardingConstructAutomationInput(
                redirectServiceRequestForwardingName,
                redirectServiceRequestRequestBody,
                redirectServiceRequestContext
            );
            forwardingConstructAutomationList.push(forwardingAutomation);
            resolve(forwardingConstructAutomationList.concat(applicationLayerTopologyForwardingInputList));
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * This function returns the operation client uuid of the service that needs to be called to log the service requests<br>
 * @returns {Promise<string>} return the uuid of the operation client of the service that needs to be addressed to log the service request<br>
 * This method performs the following step,<br>
 * step 1: extract the forwarding-construct ServiceRequestCausesLoggingRequest<br>
 * step 2: get the output fc-port from the forwarding-construct<br>
 */
async function getOperationClientToLogServiceRequestAsync() {
    let forwardingConstruct = await ForwardingDomain.getForwardingConstructForTheForwardingNameAsync(
        "ServiceRequestCausesLoggingRequest");
    if (!forwardingConstruct) {
        return undefined;
    }
    let fcPortList = forwardingConstruct["fc-port"];
    for (let fcPort of fcPortList) {
        let fcPortDirection = fcPort["port-direction"];
        if (fcPortDirection === FcPort.portDirectionEnum.OUTPUT) {
            return fcPort["logical-termination-point"];
        }
    }
}

exports.OAMLayerRequest = function (uuid) {
    return new Promise(async function (resolve, reject) {
        try {
            let applicationLayerTopologyForwardingInputList = await prepareALTForwardingAutomation.getALTForwardingAutomationInputForOamRequestAsync(
                uuid
            );
            if (applicationLayerTopologyForwardingInputList) {
                resolve(applicationLayerTopologyForwardingInputList);
            }
        } catch (error) {
            reject(error);
        }
    });
}
