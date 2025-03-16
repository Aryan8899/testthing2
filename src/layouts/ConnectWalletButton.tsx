import { useWallet, ConnectButton } from "@suiet/wallet-kit";
import { getShortAddress } from "../utils/helpers";

export const ConnectWallet_Button = () => {
  const { connected, account } = useWallet();

  return (
    <div className="p-2 sm:p-0"> 
    <ConnectButton
    className="sui-connect-button w-full max-w-[200px] sm:max-w-none rounded-xl transition-all duration-300 "

    style={{
      backgroundColor: "#292060", // Dark Blue/Purple shade
      color: "white",
      borderRadius: "1rem",
      fontSize: connected ? "0.875rem" : "1rem",
      boxShadow: `
        0 0 10px rgba(147, 51, 234, 0.4),  /* Reduced Purple-600 */
        0 0 15px rgba(59, 130, 246, 0.3),  /* Reduced Blue-600 */
        0 0 20px rgba(59, 130, 246, 0.3)   /* Reduced Blue-600 */
      `,
      cursor: "pointer",
      opacity: 2, // Slightly reduced opacity for a dimmer look
    }}
    

    
  >
      {connected ? (
        <div className="flex items-center space-x-1"
        style={{ color: "white" }}
        >
          <span className="hidden sm:inline-block"
          style={{ color: "white" }}
          >
            {getShortAddress(account?.address)}
          </span>
          <span className="inline-block sm:hidden text-ellipsis overflow-hidden max-w-[80px]
          
          "
          style={{ color: "white" }}
          >
            {getShortAddress(account?.address)}
          </span>
        </div>
      ) : (
        "Connect Wallet"
      )}
    </ConnectButton>
    </div>
  );
};
