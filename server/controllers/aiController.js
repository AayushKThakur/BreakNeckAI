import OpenAI from "openai";
import sql from "../configs/db.js";
import { clerkClient } from "@clerk/express";
import axios from "axios";
import FormData from "form-data";
import { v2 as cloudinary } from "cloudinary";
import connectCloudinary from "../configs/cloudinary.js";
import fs from "fs";
import pdf from "pdf-parse/lib/pdf-parse.js";

const AI = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

export const generateArticle = async (req, res) => {
  try {
    // Normalize auth extraction and add diagnostics
    const authData = typeof req.auth === "function" ? req.auth() : req.auth;
    const userId = authData?.userId;
    const { prompt, length } = req.body;
    console.log(
      "[generateArticle] userId, plan, free_usage:",
      userId,
      req.plan,
      req.free_usage
    );

    const plan = req.plan;
    const free_usage = req.free_usage;

    let maxTokens = parseInt(length, 10);
    if (isNaN(maxTokens) || maxTokens <= 0 || maxTokens > 2048) {
      maxTokens = 1000; // default token length
    }

    if (plan !== "premium" && free_usage >= 10) {
      return res.json({
        success: false,
        message: "Limit reached. Upgrade to continue.",
      });
    }

    const response = await AI.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    });

    const content = response.choices[0].message.content;

    await sql`INSERT INTO creations(user_id, prompt, content, type)
    VALUES (${userId}, ${prompt}, ${content}, 'article')`;

    if (plan !== "premium") {
      // Use updateUser to update private metadata and log new counter
      const newFreeUsage = (Number.isFinite(free_usage) ? free_usage : 0) + 1;
      await clerkClient.users.updateUser(userId, {
        privateMetadata: { free_usage: newFreeUsage },
      });
      console.log("[generateArticle] incremented free_usage to", newFreeUsage);
    }

    res.json({ success: true, content });
  } catch (error) {
    console.log("[generateArticle] error", error.message);
    res.json({ success: false, message: error.message });
  }
};

export const generateBlogTitle = async (req, res) => {
  try {
    // Normalize auth extraction and add diagnostics
    const authData = typeof req.auth === "function" ? req.auth() : req.auth;
    const userId = authData?.userId;
    const { prompt } = req.body;
    console.log(
      "[generateBlogTitle] userId, plan, free_usage:",
      userId,
      req.plan,
      req.free_usage
    );

    const plan = req.plan;
    const free_usage = req.free_usage;

    if (plan !== "premium" && free_usage >= 10) {
      return res.json({
        success: false,
        message: "Limit reached. Upgrade to continue.",
      });
    }

    const response = await AI.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content;

    await sql`INSERT INTO creations(user_id, prompt, content, type)
    VALUES (${userId}, ${prompt}, ${content}, 'blog-title')`;

    if (plan !== "premium") {
      const newFreeUsage = (Number.isFinite(free_usage) ? free_usage : 0) + 1;
      await clerkClient.users.updateUser(userId, {
        privateMetadata: { free_usage: newFreeUsage },
      });
      console.log(
        "[generateBlogTitle] incremented free_usage to",
        newFreeUsage
      );
    }

    res.json({ success: true, content });
  } catch (error) {
    console.log("[generateBlogTitle] error", error.message);
    res.json({ success: false, message: error.message });
  }
};

export const generateImage = async (req, res) => {
  try {
    const authData = typeof req.auth === "function" ? req.auth() : req.auth;
    const userId = authData?.userId;
    const { prompt, publish } = req.body;
    console.log("[generateImage] userId, plan:", userId, req.plan);

    const plan = req.plan;

    console.log("[generateImage] resolved plan:", plan);

    if (plan !== "premium") {
      return res.json({
        success: false,
        message: "This feature is only available for premium subscriptions",
      });
    }

    const formData = new FormData();
    formData.append("prompt", prompt);
    ///////////
    const { data } = await axios.post(
      "https://clipdrop-api.co/text-to-image/v1",
      formData,
      {
        headers: { "x-api-key": process.env.CLIPDROP_API_KEY },
        responseType: "arraybuffer",
      }
    );

    const base64Image = `data:image/png;base64,${Buffer.from(
      data,
      "binary"
    ).toString("base64")}`;
    const { secure_url } = await cloudinary.uploader.upload(base64Image);

    await sql` INSERT INTO creations(user_id, prompt, content, type, publish)
    VALUES (${userId}, ${prompt}, ${secure_url}, 'image', ${publish ?? false})`;

    res.json({ success: true, content: secure_url });
  } catch (error) {
    console.log("[generateImage] error", error.message);
    res.json({ success: false, message: error.message });
  }
};

export const removeImageBackground = async (req, res) => {
  try {
    const authData = typeof req.auth === "function" ? req.auth() : req.auth;
    const userId = authData?.userId;
    console.log("[removeImageBackground] userId, plan:", userId, req.plan);

    const image = req.file;
    const plan = req.plan;

    if (plan !== "premium") {
      return res.json({
        success: false,
        message: "This feature is only available for premium subscriptions",
      });
    }

    if (!image || !image.path) {
      return res.json({
        success: false,
        message: "No image file provided",
      });
    }

    const { secure_url } = await cloudinary.uploader.upload(image.path, {
      transformation: [
        {
          effect: "background_removal",
          background_removal: "remove_the_background",
        },
      ],
    });

    await sql`
      INSERT INTO creations(user_id, prompt, content, type)
      VALUES (${userId}, 'Remove background from image', ${secure_url}, 'image')
    `;

    res.json({ success: true, content: secure_url });
  } catch (error) {
    console.log("[removeImageBackground] error", error);
    res.json({ success: false, message: error.message });
  }
};

// export const removeImageBackground = async (req, res) => {
//   try {
//     const authData = typeof req.auth === "function" ? req.auth() : req.auth;
//     const userId = authData?.userId;
//     console.log("[removeImageBackground] userId, plan:", userId, req.plan);

//     const image = req.file;
//     const plan = req.plan;

//     if (plan !== "premium") {
//       return res.json({
//         success: false,
//         message: "This feature is only available for premium subscriptions",
//       });
//     }

//     const { secure_url } = await cloudinary.uploader.upload(image.path, {
//       transformation: [
//         {
//           effect: "background_removal",
//           background_removal: "remove_the_background",
//         },
//       ],
//     });

//     await sql`
//     INSERT INTO creations(user_id, prompt, content, type)
//     VALUES (${userId}, 'Remove background from image', ${secure_url}, 'image')
// `;

//     res.json({ success: true, content: secure_url });
//   } catch (error) {
//     console.log("[removeImageBackground] error", error.message);
//     res.json({ success: false, message: error.message });
//   }
// };

export const removeImageObject = async (req, res) => {
  try {
    const authData = typeof req.auth === "function" ? req.auth() : req.auth;
    const userId = authData?.userId;
    const { object } = req.body;
    console.log("[removeImageObject] userId, plan:", userId, req.plan);

    const image = req.file;
    const plan = req.plan;

    if (plan !== "premium") {
      return res.json({
        success: false,
        message: "This feature is only available for premium subscriptions",
      });
    }

    if (!image || !image.path) {
      return res.json({
        success: false,
        message: "No image file provided",
      });
    }

    if (!object) {
      return res.json({
        success: false,
        message: "No object specified for removal",
      });
    }

    const { public_id } = await cloudinary.uploader.upload(image.path);

    const imageUrl = cloudinary.url(public_id, {
      transformation: [{ effect: `gen_remove:${object}` }],
      resource_type: "image",
    });

    await sql`
      INSERT INTO creations(user_id, prompt, content, type)
      VALUES (${userId}, ${`Removed ${object} from image`}, ${imageUrl}, 'image')
    `;

    res.json({ success: true, content: imageUrl });
  } catch (error) {
    console.log("[removeImageObject] error", error);
    res.json({ success: false, message: error.message });
  }
};

// export const removeImageObject = async (req, res) => {
//   try {
//     const authData = typeof req.auth === "function" ? req.auth() : req.auth;
//     const userId = authData?.userId;
//     const { object } = req.body;
//     console.log("[removeImageObject] userId, plan:", userId, req.plan);

//     const image = req.file;
//     const plan = req.plan;

//     if (plan !== "premium") {
//       return res.json({
//         success: false,
//         message: "This feature is only available for premium subscriptions",
//       });
//     }

//     const { public_id } = await cloudinary.uploader.upload(image.path);

//     const imageUrl = cloudinary.url(public_id, {
//       transformation: [{ effect: `gen_remove:${object}` }],
//       resource_type: "image",
//     });
//     await sql` INSERT INTO creations(user_id, prompt, content, type)
//     VALUES (${userId}, ${`Removed ${object} from image`}, ${imageUrl}, 'image',
//     )`;

//     res.json({ success: true, content: imageUrl });
//   } catch (error) {
//     console.log("[removeImageObject] error", error.message);
//     res.json({ success: false, message: error.message });
//   }
// };

export const resumeReview = async (req, res) => {
  try {
    const authData = typeof req.auth === "function" ? req.auth() : req.auth;
    const userId = authData?.userId;
    console.log("[resumeReview] userId, plan:", userId, req.plan);

    const resume = req.file;
    const plan = req.plan;

    if (plan !== "premium") {
      return res.json({
        success: false,
        message: "This feature is only available for premium subscriptions",
      });
    }

    if (!resume || !resume.path) {
      return res.json({
        success: false,
        message: "Resume file not provided",
      });
    }

    if (resume.size > 5 * 1024 * 1024) {
      return res.json({
        success: false,
        message: "Resume file size exceeds allowed size (5MB).",
      });
    }

    const dataBuffer = fs.readFileSync(resume.path);
    const pdfData = await pdf(dataBuffer);

    const prompt = `Review the following resume and provide constructive feedback on its strengths, weakness, and areas for improvement. Resume Content:\n\n${pdfData.text}`;

    const response = await AI.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content;

    await sql`
      INSERT INTO creations(user_id, prompt, content, type)
      VALUES (${userId}, 'Review the uploaded resume', ${content}, 'resume-review')
    `;

    res.json({ success: true, content });
  } catch (error) {
    console.log("[resumeReview] error", error);
    res.json({ success: false, message: error.message });
  }
};

// export const resumeReview = async (req, res) => {
//   try {
//     const authData = typeof req.auth === "function" ? req.auth() : req.auth;
//     const userId = authData?.userId;
//     console.log("[resumeReview] userId, plan:", userId, req.plan);

//     const { resume } = req.file;
//     const plan = req.plan;

//     if (plan !== "premium") {
//       return res.json({
//         success: false,
//         message: "This feature is only available for premium subscriptions",
//       });
//     }

//     if (resume.size > 5 * 1024 * 1024) {
//       return res.json({
//         success: false,
//         message: "Resume file size exceeds allowed size (5MB).",
//       });
//     }

//     const dataBuffer = fs.readFileSync(resume.path);
//     const pdfData = await pdf(dataBuffer);

//     const prompt = `Review the following resume and provide constructive
//     feedback on its strengths, weakness, and areas for improvement.
//     Resume Content:\n\n${pdfData.text}`;

//     const response = await AI.chat.completions.create({
//       model: "gemini-2.0-flash",
//       messages: [
//         {
//           role: "user",
//           content: prompt,
//         },
//       ],
//       temperature: 0.7,
//       max_tokens: 1000,
//     });

//     const content = response.choices[0].message.content;

//     await sql`
//   INSERT INTO creations(user_id, prompt, content, type)
//   VALUES (${userId}, 'Review the uploaded resume', ${content}, 'resume-review')
// `;

//     res.json({ success: true, content });
//   } catch (error) {
//     console.log("[resumeReview] error", error.message);
//     res.json({ success: false, message: error.message });
//   }
// };
