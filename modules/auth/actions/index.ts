"use server";

import {auth} from "@/auth";

import { db } from "@/lib/db";


export const getUserById = async (id:string)=>{
    try {
        const user = await db.user.findUnique({
            where:{id},
            include:{
                accounts:true
            }
        })
        return user
    } catch (error) {
         console.log(error)
        return null
    }
}

export const getAccountByUserId = async(userId:string)=>{
    try {
        const account = await db.account.findFirst({
            where:{
                userId
            }
        })

        return account
        
    } catch (error) {
         console.log(error)
        return null
    }
}

export const currentUser  = async()=>{
    const user = await auth();
    return user?.user;
}

// Dev-only helper: remove all data for a user email to
// resolve OAuthAccountNotLinked for that email.
export const deleteUserByEmail = async (email: string) => {
    try {
        // Delete accounts linked to this user via relation filter
        await db.account.deleteMany({
            where: {
                user: { email },
            },
        });

        // Delete the user record itself
        await db.user.deleteMany({
            where: { email },
        });
    } catch (error) {
        console.log(error);
        throw error;
    }
}