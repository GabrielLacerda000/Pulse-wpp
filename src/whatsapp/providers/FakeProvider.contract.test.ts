import { FakeProvider } from "./FakeProvider";
import { runWhatsAppProviderContract } from "./WhatsAppProvider.contract";

runWhatsAppProviderContract("FakeProvider", () => {
	const provider = new FakeProvider();

	return {
		provider,
		reachQrRequired: () => provider.connect(),
		reachConnected: async () => {
			await provider.connect();
			provider.simulateQrScanned();
		},
	};
});
