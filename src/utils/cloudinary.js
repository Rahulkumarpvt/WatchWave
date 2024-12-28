import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    //upload the file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    // file has been uploaded successfully
    // console.log("file is uploaded on cloudinary ", response.url);
    fs.unlinkSync(localFilePath); // If file is uploaded successfully , then It will be automatically removed
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); // remove the  locally saved temporary file as the upload operation got failed
    return null;
  }
};

// * Deletes a file from Cloudinary
// * @param {string} publicId - The public ID of the file to be deleted
// * @returns {object} - The response from Cloudinary if successful
// * @throws {ApiError} - If deletion fails or publicId is missing

const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) {
      throw new ApiError(400, "Public ID is missing. Cannot delete file.");
    }

    // Attempt to delete the file on Cloudinary
    const response = await cloudinary.uploader.destroy(publicId);

    console.log(response);
    // Check if the deletion was successful
    //  if (response.result !== "ok") {
    //    throw new ApiError(500, `Failed to delete file from Cloudinary: ${response.result}`);
    //  }

    return response;
  } catch (error) {
    if (!(error instanceof ApiError)) {
      // Wrap unexpected errors in ApiError
      throw new ApiError(
        500,
        "An error occurred while deleting from Cloudinary.",
        error
      );
    }
    throw error; // Rethrow if already an ApiError
  }
};

export { uploadOnCloudinary, deleteFromCloudinary };
