const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

export { asyncHandler };

// const asyncHandler = ()=>{}
// const asyncHandler=(func)=>{()=>{}}
// const asyncHandler = (func)=>async()=>{}

// Try catch
// const asyncHandler = (fn) => async (req, res, next) => {
//   try {
//     await fn(req, res, next); // jo function hamne liya hai usko execute karo
//   } catch (error) {
//     res.status(err.code || 500).json({
//       success: false, //  frontend walo ko easy hota hai
//       message: err.message,
//     });
//   }
// };
