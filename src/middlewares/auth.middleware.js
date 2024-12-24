// Ye middleware verify karega ki user hai ya nahi hai
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

//Jab bhee ham middleware likhate hai tab hame jarurat hota hai next ka
export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );

    if (!user) {
      // TODO: discuss about frontend
      throw new ApiError(401, "Invalid Access Token");
    }
    // Hamare paas access hai request ka to ham add is req me ek naya object add kar denge " user" name se
    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.meassage || "Invalid access token");
  }
});
