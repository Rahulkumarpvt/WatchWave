import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination
  console.log(userId);
  const pipeline = [];

  // for using Full Text based search u need to create a search index in mongoDB atlas
  // you can include field mapppings in search index eg.title, description, as well
  // Field mappings specify which fields within your documents should be indexed for text search.
  // this helps in seraching only in title, desc providing faster search results
  // here the name of search index is 'search-videos'

  if (query) {
    pipeline.push({
      $search: {
        index: "search-videos",
        text: {
          query: query,
          path: ["title", "description"], //search only on title, description
        },
      },
    });
  }
  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid user id");
    }
    pipeline.push({
      $match: {
        owner: mongoose.Types.ObjectId(userId),
      },
    });
  }

  // fetch videos only that are set isPublished as true
  pipeline.push({ $match: { isPublished: true } });

  //sortBy can be views, createdAt, duration
  //sortType can be ascending(-1) or descending(1)
  if (sortBy && sortType) {
    pipeline.push({
      $sort: {
        [sortBy]: sortType === "asc" ? 1 : -1,
      },
    });
  } else {
    pipeline.push({ $sort: { createdAt: -1 } });
  }

  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline: [
          {
            $project: {
              username: 1,
              "avatar.url": 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$ownerDetails",
    }
  );
  const videoAggregate = Video.aggregate(pipeline);

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };

  const video = await Video.aggregatePaginate(videoAggregate, options);

  // Check if requested page exceeds totalPages
  // if (video.page > video.totalPages) {
  //   return res.status(404).json({
  //     status: 404,
  //     message: `Page ${video.page} does not exist. Maximum pages: ${video.totalPages}.`,
  //     data: [],
  //   });
  // }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  if ([title, description].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }
  // TODO: get video, upload to cloudinary, create video
  const videoFileLocalPath = req.files?.videoFile[0]?.path; // local par multer ne upload kar diya
  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

  if (!videoFileLocalPath) {
    throw new ApiError(400, "videoFileLocalPath is required");
  }

  if (!thumbnailLocalPath) {
    throw new ApiError(400, "thumbnailLocalPath is required");
  }

  const videoFile = await uploadOnCloudinary(videoFileLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!videoFile) {
    throw new ApiError(400, "Video file not found");
  }

  if (!thumbnail) {
    throw new ApiError(400, "Thumbnail not found");
  }

  const video = await Video.create({
    title,
    description,
    videoFile: {
      url: videoFile.url,
      public_id: videoFile.public_id,
    },
    thumbnail: {
      url: thumbnail.url,
      public_id: thumbnail.public_id,
    },
    duration: videoFile.duration, // cloudinary se video duration nikalna hai
    owner: req.user?._id,
    isPublished: false,
  });

  const videoUploaded = await Video.findById(video._id);

  if (!videoUploaded) {
    throw new ApiError(500, "Video not uploaded , please try again !!!");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, videoUploaded, "Video uploaded successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }
  if (!isValidObjectId(req.user?._id)) {
    throw new ApiError(400, "Invalid user id");
  }

  const video = await Video.aggregate([
    {
      $match: {
        _id: mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          {
            $addFields: {
              subscribersCount: {
                $size: "$subscribers",
              },
              isSubscribed: {
                $cond: {
                  if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              username: 1,
              "avatar.url": 1,
              subscribersCount: 1,
              isSubscribed: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likes",
        },
        owner: {
          $first: "$owner",
        },
        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "$likes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        "videoFile.url": 1,
        title: 1,
        description: 1,
        views: 1,
        createdAt: 1,
        duration: 1,
        comments: 1,
        owner: 1,
        likesCount: 1,
        isLiked: 1,
      },
    },
  ]);

  if (!video) {
    throw new ApiError(500, "failed to fetch video");
  }

  // increment views if video fetched successfully
  await Video.findByIdAndUpdate(
    videoId,
    {
      $inc: { views: 1 },
    },
    { new: true }
  );

  // add this video to user watch history
  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $addToSet: { watchHistory: videoId },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, video[0], "Video  details fetched successfully")
    );
});

//TODO: update video details like title, description, thumbnail
const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  if (!(title && description)) {
    throw new ApiError(400, "title and description fields are required");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this video");
  }

  //deleting old thumbnail and updating with new one
  const thumbnailToDelete = video.thumbnail.public_id;
  const thumbnailLocalPath = req.file?.path;
  if (!thumbnailLocalPath) {
    throw new ApiError(400, "thumbnail is required");
  }

  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!thumbnail) {
    throw new ApiError(500, "Failed to upload thumbnail");
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        thumbnail: {
          url: thumbnail.url,
          public_id: thumbnail.public_id,
        },
      },
    },
    { new: true }
  );

  if (!updatedVideo) {
    throw new ApiError(500, "Failed to update video please try again !!!");
  }

  if (updatedVideo) {
    await deleteFromCloudinary(thumbnailToDelete);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

// TODO: delete video
const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this video");
  }

  const videoDeleted = await Video.findByIdAndDelete(video?._id);

  if (!videoDeleted) {
    throw new ApiError(500, "Failed to delete video, please try again !!!");
  }

  await deleteFromCloudinary(video?.thumbnail?.public_id); // video model has thunbnail public_id stored in it
  await deleteFromCloudinary(video?.videoFile?.public_id, "video"); // specify video while deleting video file

  // delete video likes
  await Like.deleteMany({ video: videoId });
  // delete video comments
  await Comment.deleteMany({ video: videoId });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

// toggle publish status of a video
const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(
      403,
      "You are not authorized to toggle publish status of this video"
    );
  }

  const toggleVideoStatus = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        isPublished: !video.isPublished,
      },
    },
    { new: true }
  );

  if (!toggleVideoStatus) {
    throw new ApiError(
      500,
      "Failed to toggle publish status of video, please try again !!!"
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isPublished: toggleVideoStatus.isPublished },
        "Video publish status toggled successfully"
      )
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
