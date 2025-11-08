import cors from "cors";
import config from "../config";

const corsOptions = {
  origin: [config.client_url],
  credentials: true,
  optionsSuccessStatus: 200,
};

export default cors(corsOptions);
