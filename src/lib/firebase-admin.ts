import admin from "firebase-admin"

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "klip-6e9a8",
      privateKey: `-----BEGIN PRIVATE KEY-----\\nMIIEuQIBADANBgkqhkiG9w0BAQEFAASCBKMwggSfAgEAAoIBAQC7cxp9N/r1VSdXuWnKLq5QwVBPSLX54pd3tjiu9Jqimm57/CTGcAcLsfJG77TEy0Ggj7gQ1JOTF+9x5YcGD3F7wYjI25uQ5iBY3XsydLbY2oNr3KJgW7wHxYPWWPBFJcFTfNgVDyxADMDGXWR6A1idMS97nTEV0qrflH0SYUShOiGOZ+lWRMzYJQaOei4E7PWEy2c8b97jnD0mIint9FO3ltH/1U4/mLYlx2B0u6eJ/MmvJ/RmgLUtT6tVQ2WZMjGlJ5HXaKvd0OG5W55umbDf+rFYq104OdbfyzvMZ5O2u3NN/QrzbJAtjBLvmPVSLMmOoNy+u1AxYFSQghHuKttHAgMBAAECgf8/8lnBs1c/BSMRdNn3dKAC7Jp5HFT4P6oXLL1+8fMkMDWAwS51Lm045XvBYgTzyGNFuGxn/B0Gu85JDK8DYkFUoVwIfuKTNpknt7xPeiw7zk+x0ZLoobguQ94LQaFgoCtTpUNnQRssvoJaftcdc1wc7qqZgQaTFfXfpXMFfNPs1qfPIdQnIzUILpT2dcacwQi/XQhy+VYbNFPsjdGqk1pLha1x+HJquGDZjl5lQjTFM8+fy/1VrBT+vPmaD53tVI+2xjbjin89vZQSlEoEO3taG195R17aVc3T+SfKMdtIO8dUIdXaYqAN4OjLXsHy48fsogL9juQukdMiVzK2RIECgYEA3LCnZv8oSuz8545XwPPsCgjn6y8+Zw0Xw09uqGbVxbVzAZDAQ3VhltoTU1eJweXboOuXFxTl8nihfq5xsst6+Y2lek0DboLrKITcVTbiQo0pE5I3+4IfFbvGkvbbAKMxzcJ7UrhpBInlGzhf3RK0gxwvBMdXyTnPTrFmTaGngqcCgYEA2XDweLX9KXuamLa6pIyE4yyOJKmCOBdgByQ9DZWYougf/H+/X6OeUWk1XWC64aXdAypVapzbAT0GM3jKN7lZ8KI/2/KvWGAQRIA/sP94aa3q2aFdXWrA49aAzLRHQoiGiYPzjzxSQ//6ILxELclMHu5M5r/6WNQETRdLpdrIFmECf2TcV6W6969GoE8zvudwk3ACofvam6p9UV7x7qEIXqr9QpJ0lWo/O1q2UB7G4y663qWtBmCGLJGkkCpVj6EnXgyvr/E1QVxAeTkLf6dybfX8jclkCjHoRkyohRiluXGRJDHlsHcd0OFCJHNMUIO5CMbjGpoUgQp2YUiVyyuvtd8CgYEAhTAfq+DVjCZRAL/UvVvxPfGZs608vTzcLiOtXffHAeorRY++WkevfvBxppvMfNEK+phgr6gaobyOYtLXEqDvDW1krkYNz5UwAbWIzdL+H8VO+DVWKhVsx2IpjLnUeFWGCw+PDaqGPW66+Hg5Ts5hWQTgh+sJ3oUniUz+oj3Ll6ECgYBUNYGMO0sOL/wYNfBFt4/Ioyarhuh1QklzjHW5fxT4/31JTolGjKOtx4gq7QMw8U9ryUqfg33dgWQoXxWnge2EpDJfRuuAa8GwHfhF6L/CT/HahyXAE72xjeV7/TRNzfV0ZNugidCZzes3DhwB3yX/Xpxd+BhCNFIOqJxgzaGm5g==\\n-----END PRIVATE KEY-----`.replace(/\\n/g, '\n'),
      clientEmail: "firebase-adminsdk-fbsvc@klip-6e9a8.iam.gserviceaccount.com",
    }),
  })
}

export const adminDB = admin.firestore()
export const adminAuth = admin.auth()
