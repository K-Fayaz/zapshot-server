// In your Node.js backend controller file
const fetch = require('node-fetch'); // If not available, install with: npm install node-fetch

// Helper to extract slug from a Product Hunt product URL
function extractProductSlug(url) {
  const match = url.match(/producthunt\.com\/(?:products|posts)\/([^\/?#]+)/i);
  return match ? match[1] : null;
}

let token = process.env.DEVELOPER_TOKEN;
// Helper function: fetch Product Hunt launch details
async function getProductHuntLaunchDetails(url) {
    // console.log("prduct launch url is : ",url);
    const slug = extractProductSlug(url);
    if (!slug) {
        throw new Error('Invalid Product Hunt launch URL.');
    }

    // makers { name, username, profileImage }
    // id
    const graphqlQuery = {
        query: `
        query {
            post(slug: "${slug}") {
            name
            tagline
            description
            createdAt
            commentsCount
            votesCount
            thumbnail { url }
            topics {
                edges {
                node {
                    name
                }
                }
            }
            url
            }
        }
        `
    };


    try {
        const apiResponse = await fetch('https://api.producthunt.com/v2/api/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(graphqlQuery)
        });

        const data = await apiResponse.json();

        if (data.errors) {
            throw new Error(data.errors.map(e => e.message).join(', '));
        }

        // console.log("data is : ",data);

        return data.data.post;
    } catch (err) {
        throw new Error(`Failed to fetch data from Product Hunt: ${err.message}`);
    }
}

module.exports = { getProductHuntLaunchDetails };
