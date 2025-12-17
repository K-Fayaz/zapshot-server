const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const { exec } = require('child_process');
const YTDlpWrap = require('yt-dlp-wrap').default;

const {
    getThreadsVideo,
    scrapeThreadsPosts,
    extractThreadsPostsData,
} = require("../helpers/Threads.scraper");

const {
    getRedditVideoData
} = require("../helpers/Reddit.scraper");

const { scrapeTweetHTML, scrapeTweetVideoUrls, combineAudioVideoFromUrls } = require("../helpers/Twitter.scraper");

const ThreadsVideoDownloader = async (req,res) => {
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({ error: "Missing tweet URL" });
        }
    
        let platform = url.split('/')[2];
    
        if (!platform.includes('threads.com')) {
            return res.status(400).json({ error: "Invalid URL" });
        }
    
        let html = await scrapeThreadsPosts(url);
        let data = await extractThreadsPostsData(html,url);

        let video = data[0]?.videos[0]?.src || null;
    
        return res.status(200).json({ video: video });
    }
    catch(error){
        console.log(error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const TwitterVideoDownloader = async (req,res) => {
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({ error: "Missing tweet URL" });
        }
    
        let platform = url.split('/')[2];
    
        if (!platform.includes('x.com')) {
            return res.status(400).json({ error: "Invalid URL" });
        }
    
        // Use the new network interception scraper
        const videoUrls = await scrapeTweetVideoUrls(url);
        // if (videoUrls.length === 0) {
        //     return res.status(200).json({ status: false, message: "No video URLs found." });
        // }

        console.log(videoUrls)

        return res.status(200).json({
            videos: videoUrls
        });
    }
    catch(err) {
        console.log(err);
        return res.status(500).json({
            status: false,
            message:"Something went wrong!"
        });
    }
}

const TwitterDownload = async (req, res) => {
    try {
        const { tweetUrl } = req.body;
        if (!tweetUrl) {
            return res.status(400).json({ error: "Missing tweet URL" });
        }
    
        let platform = tweetUrl.split('/')[2];
    
        if (!platform.includes('x.com')) {
            return res.status(400).json({ error: "Invalid URL" });
        }
    
        // Use the new network interception scraper
        const videoUrls = await scrapeTweetVideoUrls(tweetUrl);
        if (videoUrls.length === 0) {
            return res.status(404).json({ status: false, message: "No video URLs found." });
        }

        console.log(videoUrls)

        let { outputPath } = await combineAudioVideoFromUrls(videoUrls);

        console.log(outputPath);

        res.setHeader('Content-Disposition', 'attachment; filename="twitter_video.mp4"');
        res.setHeader('Content-Type', 'video/mp4');
        const stream = fs.createReadStream(outputPath);
        stream.pipe(res);
        stream.on('close', () => fs.unlinkSync(outputPath));
    }
    catch(err) {
        console.log(err);
        return res.status(500).json({
            status: false,
            message:"Something went wrong!"
        });
    }
}

const getRedditVideo = async(req,res) => {
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({ error: "Missing tweet URL" });
        }
    
        let data;
    
        let platform = url.split('/')[2]; 

        if (!platform.includes('reddit.com')) {
            return res.status(400).json({
                status: false,
                message:"Invalid URL"
            });
        }

        let videos = await getRedditVideoData(url) || [];

        // console.log(html);

        return res.status(200).json({
          status: true,
          platform,
          videos: videos,
        });
    }
    catch(err) {
        console.log(err);
        res.status(500).json({
            status: false,
            message:"Something went wrong!"
        });
    }
}

const videoDownload = async (req,res) => {
    try {
        const videoUrl = decodeURIComponent(req?.query?.url);
        console.log("Video URL:", videoUrl);

        if (!videoUrl) {
            return res.status(400).json({
                status: false,
                message:"Missing video URL"
            });
        }   

        const outputPath = path.join(__dirname, "temp.mp4");

        ffmpeg(videoUrl)
            .addOption('-protocol_whitelist', 'file,http,https,tcp,tls')
            .addOption('-allowed_extensions', 'ALL')
            .outputOptions('-c copy')
            .on("end", () => {
                res.download(outputPath, "video.mp4", () => {
                    // Optional: clean up temp file
                    fs.unlinkSync(outputPath);
                });
            })
            .on("error", err => {
                console.error("Error:", err.message);
                res.status(500).json({status: false,message:"Download failed"});
            })
            .save(outputPath);

    }
    catch(err) {
        return res.status(500).json({
            status: false,
            message:"Something went wrong!"
        });
    }

}

const downloadRedditVideo = async (req, res) => {
    try {
        const videoUrl = req?.query?.url;
        const outputPath = path.join(__dirname, "video.%(ext)s");

        const ytDlpWrap = new YTDlpWrap();

         await ytDlpWrap.execPromise([
            videoUrl,
            '-o', outputPath,
            '--no-playlist'
        ]);
        
        // Find the downloaded file
        const files = fs.readdirSync(__dirname).filter(f => f.startsWith('video.'));
        if (files.length > 0) {
            const actualPath = path.join(__dirname, files[0]);
            res.download(actualPath, "video.mp4", () => {
                fs.unlinkSync(actualPath);
            });
        }

    }
    catch(err) {
        console.log(err);
        return res.status(500).json({
            status: false,
            message: err?.message ||"Something went wrong!" 
        });
    }

}

module.exports = {
    ThreadsVideoDownloader,
    TwitterVideoDownloader,
    TwitterDownload,
    getRedditVideo,
    videoDownload,
    downloadRedditVideo
}