'use strict';

var utils = require('../utils/writer.js');
var ServiceRecordProfile = require('../service/ServiceRecordProfileService');

module.exports.getServiceRecordProfileCapability = function getServiceRecordProfileCapability (req, res, next, uuid) {
  ServiceRecordProfile.getServiceRecordProfileCapability(uuid)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};
