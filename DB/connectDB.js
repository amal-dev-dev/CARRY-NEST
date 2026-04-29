import mongoose from "mongoose";

const connectDB = async () => {
    try {
        const conn = await mongoose.connect('mongodb://localhost:27017/CARRY_NEST', {});
        console.log(`MongoDB Connected: ${conn.connection.host}`);  
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

export default connectDB;