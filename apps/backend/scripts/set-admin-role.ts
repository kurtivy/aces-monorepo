import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setUserAsAdmin(walletAddress: string) {
  try {
    console.log(`Looking for user with wallet address: ${walletAddress}`);

    const user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!user) {
      console.error(`❌ User with wallet address ${walletAddress} not found`);
      console.log('Make sure the user has connected their wallet to the app first');
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.id}`);
    console.log(`📧 Email: ${user.email || 'Not set'}`);
    console.log(`🎭 Current role: ${user.role}`);

    if (user.role === 'ADMIN') {
      console.log('✅ User is already an admin!');
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    });

    console.log(`🎉 Successfully updated user role to ADMIN`);
    console.log(`👤 User ID: ${updatedUser.id}`);
    console.log(`💰 Wallet: ${updatedUser.walletAddress}`);
    console.log(`🎭 New Role: ${updatedUser.role}`);
    console.log(`\n🚀 The user can now access admin features!`);
  } catch (error) {
    console.error('❌ Error setting admin role:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get wallet address from command line argument
const walletAddress = process.argv[2];

if (!walletAddress) {
  console.error('❌ Usage: npm run set-admin <wallet-address>');
  console.error('📝 Example: npm run set-admin 0x1234567890123456789012345678901234567890');
  process.exit(1);
}

console.log('🔧 Setting user as admin...\n');
setUserAsAdmin(walletAddress);
