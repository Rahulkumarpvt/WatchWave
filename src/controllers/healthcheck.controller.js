import { ApiResponse } from "../utils/ApiResponse";

const healthCheck = asycHandler(async (req, res) => {
  return res
    .status(200)
    .json(ApiResponse(200, { message: "Everything is o.k." }, "ok"));
});

export { healthCheck };
