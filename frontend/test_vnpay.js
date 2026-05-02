const crypto = require("crypto");
const qs = require("qs");

const secret = "ROEK5KV0SQJCXOI9SU5BHRKICU2BR4TL";

function encodeVnpComponent(value) {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

function sortAndEncodeParams(params) {
  const sortedKeys = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .sort();

  const encoded = {};
  for (const key of sortedKeys) {
    encoded[key] = encodeVnpComponent(String(params[key]));
  }
  return encoded;
}

function sortObject(params) {
  const keys = Object.keys(params).sort();
  const sorted = {};
  for (const key of keys) {
    const raw = params[key];
    if (raw === undefined || raw === null || raw === "") continue;
    sorted[key] = encodeURIComponent(String(raw)).replace(/%20/g, "+");
  }
  return sorted;
}

const params = {
  vnp_Version: "2.1.0",
  vnp_Command: "pay",
  vnp_TmnCode: "1993TQTF",
  vnp_Amount: "500000",
  vnp_CurrCode: "VND",
  vnp_TxnRef: "ORD123",
  vnp_OrderInfo: "Thanh toan don hang ORD123",
  vnp_OrderType: "other",
  vnp_Locale: "vn",
  vnp_ReturnUrl: "http://localhost:3000/payment/vnpay-return",
  vnp_IpAddr: "127.0.0.1",
  vnp_CreateDate: "20240101120000",
  vnp_ExpireDate: "20240101121500",
};

const hashDataApp = qs.stringify(sortAndEncodeParams(params), { encode: false });
const hashApp = crypto.createHmac("sha512", secret).update(hashDataApp, "utf8").digest("hex");

console.log("App hashData:");
console.log(hashDataApp);
console.log("App hash:", hashApp);

const hashDataTutorial = qs.stringify(sortObject(params), { encode: false });
const hashTutorial = crypto.createHmac("sha512", secret).update(hashDataTutorial, "utf8").digest("hex");

console.log("\nTutorial hashData:");
console.log(hashDataTutorial);
console.log("Tutorial hash:", hashTutorial);
