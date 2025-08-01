// Quick test file to verify Vision API setup
require('dotenv').config();
const { ImageAnnotatorClient } = require('@google-cloud/vision');

async function testVisionAPI() {
  try {
    // Check if required environment variables are set
    const requiredEnvVars = [
      'GOOGLE_CLOUD_PROJECT_ID',
      'GOOGLE_CLOUD_SECURE_CLIENT_EMAIL',
      'GOOGLE_CLOUD_SECURE_PRIVATE_KEY',
    ];

    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
      console.log('❌ Missing required environment variables:');
      missingVars.forEach((varName) => console.log(`   - ${varName}`));
      console.log('\n💡 To set up Google Cloud Vision API:');
      console.log('   1. Create a Google Cloud project at https://console.cloud.google.com/');
      console.log('   2. Enable the Vision API for your project');
      console.log('   3. Create a service account and download the JSON key file');
      console.log('   4. Set the following environment variables:');
      console.log('      export GOOGLE_CLOUD_PROJECT_ID="your-project-id"');
      console.log(
        '      export GOOGLE_CLOUD_SECURE_CLIENT_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"',
      );
      console.log(
        '      export GOOGLE_CLOUD_SECURE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"',
      );
      console.log('\n   Or create a .env file in the backend directory with these variables.');
      console.log('\n   For testing without credentials, you can run:');
      console.log(
        '   GOOGLE_CLOUD_PROJECT_ID=test GOOGLE_CLOUD_SECURE_CLIENT_EMAIL=test@test.com GOOGLE_CLOUD_SECURE_PRIVATE_KEY="test-key" node src/test-vision.js',
      );
      return;
    }

    const client = new ImageAnnotatorClient({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLOUD_SECURE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_SECURE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
    });

    console.log('✅ Vision API client created successfully');

    // Test with a public image
    const [result] = await client.labelDetection({
      image: { source: { imageUri: 'gs://cloud-samples-data/vision/label/wakeupcat.jpg' } },
    });

    console.log('✅ Vision API call successful!');
    console.log('Labels detected:', result.labelAnnotations?.map((l) => l.description).slice(0, 3));
  } catch (error) {
    console.error('❌ Vision API test failed:', error.message);

    if (error.message.includes('403')) {
      console.log('💡 Make sure to:');
      console.log('   1. Enable Vision API in Google Cloud Console');
      console.log('   2. Enable billing for your project');
      console.log('   3. Grant Vision API permissions to your service account');
    } else if (error.message.includes('client_email')) {
      console.log('💡 Check that your GOOGLE_CLOUD_SECURE_CLIENT_EMAIL is correctly set');
    } else if (error.message.includes('private_key')) {
      console.log('💡 Check that your GOOGLE_CLOUD_SECURE_PRIVATE_KEY is correctly formatted');
      console.log('   The private key should include the BEGIN and END markers');
    }
  }
}

// Test facial verification specifically
async function testFacialVerificationFlow() {
  try {
    console.log('\n🧪 Testing Facial Verification Flow...');

    // Test database connection
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    console.log('📊 Checking verification records in database...');
    const verifications = await prisma.accountVerification.findMany({
      take: 5,
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        userId: true,
        status: true,
        documentImageUrl: true,
        facialVerificationStatus: true,
        submittedAt: true,
      },
    });

    console.log(`Found ${verifications.length} verification records:`);
    verifications.forEach((v, i) => {
      console.log(
        `  ${i + 1}. ID: ${v.id.slice(0, 8)}..., Status: ${v.status}, HasDoc: ${!!v.documentImageUrl}, FacialStatus: ${v.facialVerificationStatus || 'NULL'}`,
      );
    });

    if (verifications.length === 0) {
      console.log('❌ No verification records found - user needs to complete Step 1 first!');
    } else {
      const latestVerification = verifications[0];
      if (!latestVerification.documentImageUrl) {
        console.log(
          '❌ Latest verification has no document image - user needs to upload document!',
        );
      } else {
        console.log('✅ Latest verification has document image - ready for facial verification');
      }
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Facial verification flow test failed:', error.message);
  }
}

// Run both tests
testVisionAPI().then(() => {
  testFacialVerificationFlow();
});
