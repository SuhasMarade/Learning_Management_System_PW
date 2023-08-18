import User from "../models/user.model.js"
import AppError from "../utils/error.util.js";
import cloudinary from "cloudinary";
import fs from 'fs/promises';
import crypto from 'crypto';
import { config } from 'dotenv';
config();

const cookieOption = {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: true
}
const register = async (req, res, next) => {
    const {fullName,email,password} = req.body;

    if(!fullName || !email || !password){
        return next(new AppError("All fields are requird", 400));
    }
    const userExist = await User.findOne({ email });

    if(userExist){
        return next(new AppError("User already exist", 400));
    }
    const user = await User.create({
        fullName,
        email,
        password,
        avatar:{
            public_id: email,
            secure_url: "https//res.cloudinary.com/du09jklz/image/upload"
        }
    });
    if(!user){
        return next(new AppError('User registration failed, Please try again', 400));
    }

    // TO DO file upload

    if(req.file){
        try {
            const result = await cloudinary.v2.uploader.upload(req.file.path, {
                folder: 'lms',
                width: 250,
                height: 250,
                gravity: 'faces',
                crop: 'fill'
            });

            if(result){
                user.avatar.public_id = result.public_id;
                user.avatar.secure_url = result.secure_url;

                fs.rm(`uploads/${req.file.filename}`)
            }

        } catch (e) {
            return next(
                new AppError(e.message || "file is not uploaded", 500)
            )
        }
    }
    await user.save();

    user.password = undefined;

    const token = user.generateJWTToken();

    res.cookie('token',token,cookieOption);

    res.status(201).json({
        success: true,
        message: "User registration successfully",
        user
    })
}

const login = async (req, res, next) => {
    try {
        const {email, password} = req.body;

        if(!email || !password){
            return next(new AppError("All fields are required", 400));
        }
    
        const  user = await User.findOne(
            {
                email
            }
        ).select('+password');
    
        if(!user || !user.comparePassword(password)){
            return next(new AppError("Email or password does not match",400))
        }
    
        const token = await user.generateJWTToken();
        user.password = undefined;
    
        res.cookie('token', token, cookieOption);
    
        res.status(200).json({
            success: true,
            message: "User loggedin successfully",
            user
        })
    } catch (e) {
        return next(new AppError(e.message, 500));
    }
}

const logout = (req, res) => {
    res.cookie('token', null, {
        secure: true,
        maxAge: 0,
        httpOnly: true
    });

    res.status(200).json({
        success: true,
        message: "User logged out successfully"
    })
}

const getProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        res.status(200).json({
            success: true,
            message: "User Detail",
            user
        });
    } catch (e) {
        return next(new AppError("Failed to fetch profile details", 500));
    }
}

const forgotPassword = async (req, res, next) => {
    const {email} = req.body;

    if(!email) {
        return next(new AppError("Email is required", 400));
    }

    const user = await User.findOne({email});
    if(!user) {
        return next(new AppError("User is not registered", 400));
    }

    const resetToken = await user.generatePasswordResetToken();

    await user.save();

    const resetPasswordUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const subject = 'Reset Password'
    const message = `You can reset your password by clicking <a href = ${resetPasswordUrl} target = "_blanck">Reset Your Password </a>\nIf the above link does not work for some reason then copy past this link in the new tab${resetPassword}.\nIf you have not requested this, kindly ignore`;
    try {
        await sendEmail(email, subject, message);
        res.status(200).json({
            success: true,
            message: `Reset password token has been sent to an ${email} successfully`
        })
    } catch (e) {
        user.forgotPasswordExpiry = undefined;
        user.forgotPasswordToken = undefined;

        await user.save();

        return next(new AppError(e.message, 500));
    }
}

const resetPassword = async (req, res, next) => {
    const {resetToken} = req.params;

    const {password} = req.body;

    const forgotPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    const user = await User.findOne({
        forgotPasswordToken,
        forgotPasswordExpiry: { $gt: Date.now()}
    });

    if(!user){
        return next(
            new AppError("Token is invalid or expired, please try again", 400)
        );
    }

    user.password = password;
    user.forgotPasswordExpiry = undefined;
    user.forgotPasswordToken = undefined;

    user.save();

    res.status(200).json({
        success: true,
        message: "Password changed successfully!"
    })

}

const changedPassword = async (req, res, next) => {
    const {oldPassword, newPassword} = req.body;
    const {id} = req.user;

    if(!oldPassword || !newPassword) {
        return next(new AppError("All fields are mandantory",400));
    }

    const user = await User.findById(id).select("+password");
    if(!user){
        return next(new AppError("User doesn't exist with this id",400));
    }

    const isPasswordValid = await user.comparePassword(oldPassword);
    if(!isPasswordValid){
        return next(new AppError("Invalid old password",400));
    }
    user.password = newPassword;
    await user.save();

    user.password = undefined;

    res.status(200).json({
        success: true,
        message: "Password changed successfully!"
    })
}

const updateUser = async (req, res, next) => {
    const {fullName} = req.body;
    const {id} = req.user.id;

    const user = await User.findById(id);
    if(!user){
        return next(new AppError("User does not exist", 400));
    }

    if(req.fullName){
        user.fullName = fullName;
    }

    if(req.file) {
        await cloudinary.v2.uploader.destroy(user.avatar.public_id);
        try {
            const result = await cloudinary.v2.uploader.upload(req.file.path, {
                folder: 'lms',
                width: 250,
                height: 250,
                gravity: 'faces',
                crop: 'fill'
            });

            if(result){
                user.avatar.public_id = result.public_id;
                user.avatar.secure_url = result.secure_url;

                fs.rm(`uploads/${req.file.filename}`)
            }

        } catch (e) {
            return next(
                new AppError(e.message || "file is not uploaded", 500)
            )
        }
    }
    await user.save();
    res.status(200).json({
        success: true,
        message: "User details are updated successfully"
    })
}
export {
    register,
    login,
    logout,
    getProfile,
    forgotPassword,
    resetPassword,
    changedPassword,
    updateUser
}