import QRCode from "qrcode";

const res = await fetch("http://localhost:3000/whatsapp/qr", {
	headers: { Authorization: "Bearer baileys-stub" },
});
const { qr } = await res.json();

if (!qr) {
	console.log("No QR available right now - is status qr_required?");
	process.exit(1);
}

console.log("Raw QR string:");
console.log(qr);

const outPath =
	"C:\\Users\\GABRIEL\\AppData\\Local\\Temp\\claude\\C--Users-GABRIEL-Documents-projetos-pulse-wpp\\47529732-0613-4734-b73f-e7a36b0b7bcf\\scratchpad\\whatsapp-qr.png";
await QRCode.toFile(outPath, qr, { width: 500, margin: 4 });
console.log("Saved PNG to", outPath);
