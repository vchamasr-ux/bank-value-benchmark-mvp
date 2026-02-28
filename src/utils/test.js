const { generateHtmlBriefString } = require('./exportHtmlBriefTest.js');

try {
    const financials = {};
    const benchmarks = {};
    const aiSummary = {};
    console.log(generateHtmlBriefString(financials, benchmarks, aiSummary));
} catch (e) {
    console.error("ERROR CAUGHT: ", e.message);
}
