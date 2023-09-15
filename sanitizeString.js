const validator = require("validator");

function sanitizeString(dirtyString) {
    let cleanString = dirtyString;
    // The following 2 methods remove / sign from the string which is necessary for patientFile format
    // cleanString = validator.blacklist(dirtyString, /<>`"'~/);
    // cleanString = validator.escape(cleanString);
    cleanString = validator.trim(cleanString);
    cleanString = validator.stripLow(cleanString);
    return cleanString;
}

module.exports = { sanitizeString };