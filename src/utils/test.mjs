import { generateHtmlBriefString } from "./exportHtmlBrief.js";

const financials = {
  raw: {
    NAME: "Test Bank",
    ASSET: "1000000"
  },
  reportDate: "Q3 2025",
  returnOnAssets: "1.2",
  efficiencyRatio: "55.0",
  nptlRatio: "0.5"
};
const benchmarks = {
  groupName: "Test Group",
  sampleSize: 10,
  returnOnAssets: "1.0",
  efficiencyRatio: "60.0",
  nptlRatio: "1.0"
};

try {
  console.log(generateHtmlBriefString(financials, benchmarks, { summary: "**Test** summary\n* Item 1" }));
} catch(e) {
  console.error("ERROR CAUGHT:", e.message);
}
