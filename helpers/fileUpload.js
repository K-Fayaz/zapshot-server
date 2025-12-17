
const { Storage } = require('@google-cloud/storage');

// Alternative: Just add this to your existing function
async function uploadDebugHTML(html, platform ) {
    try {
        const storage = new Storage({
            projectId: process.env.PROJECT_NAME,
            credentials: {
                client_email: process.env.CLIENT_EMAIL,
                private_key: process.env.SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'),
            }
        });
        const bucketName = process.env.BUCKET_NAME; // Replace with your bucket name
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `debug/${platform}-html-${timestamp}.html`;
        
        await storage.bucket(bucketName).file(fileName).save(html, {
            metadata: { contentType: 'text/html' }
        });
        
        console.log(`[DEBUG] Uploaded: ${fileName}`);
        return fileName;
    } catch (error) {
        console.error('[DEBUG] Upload failed:', error);
        return null;
    }
}

module.exports = {
    uploadDebugHTML
};