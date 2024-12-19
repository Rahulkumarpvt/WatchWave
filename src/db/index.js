import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`
    );
    console.log(
      `\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`
    );
  } catch (error) {
    console.log("MONGODB connection FAILED", error);
    process.exit(1); //Nodejs process deta hai isko throw error ke jagah use kar sakte hai ,   ye jo hamari current application chal rahi hai , ye ek process par chal rahi hai. Aap process ko exit bhee kara sakte ho
  }
};

export default connectDB;
