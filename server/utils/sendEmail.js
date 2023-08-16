import nodemailer, { createTransport } from 'nodemailer';

//async await not allowed in global scope must use a wrapper
const sendEmail = async function(email, subject, message){
    // create reusable transporter object using default SMTP Transport
    let transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false, //only true for port 465
        auth : {
            user: process.env.SMTP_USERNAME,
            pass: process.env.SMTP_PASSWORD
        }
    });
// send email with defined transport object
    await transporter.sendMail({
        from: process.env.SMTP_FROM_EMAIL, //sender address
        to: email, // user email
        subject: subject,
        html: message // html body
    });
}

export default sendEmail;