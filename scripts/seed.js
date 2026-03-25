/**
 * ConnectAI — Sample Data Seed Script
 * Run: node backend/scripts/seed.js
 *
 * Creates:
 *  - 1 Admin
 *  - 5 Brands  + BrandProfiles
 *  - 10 Influencers + InfluencerProfiles
 *  - 8 Campaigns
 *  - 12 Applications
 *  - 4 Contracts
 *  - 4 Payments
 *  - 3 Subscriptions
 *  - 5 Conversations + Messages
 *  - 20 Notifications
 *  - PlatformSettings (global)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

// ── Models ────────────────────────────────────────────────────────────────────
const User             = require('../src/models/User');
const BrandProfile     = require('../src/models/BrandProfile');
const InfluencerProfile = require('../src/models/InfluencerProfile');
const Campaign         = require('../src/models/Campaign');
const Application      = require('../src/models/Application');
const Contract         = require('../src/models/Contract');
const Payment          = require('../src/models/Payment');
const Subscription     = require('../src/models/Subscription');
const Conversation     = require('../src/models/Conversation');
const Message          = require('../src/models/Message');
const Notification     = require('../src/models/Notification');
const PlatformSettings = require('../src/models/PlatformSettings');

// ── Helpers ───────────────────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const future = (days) => new Date(Date.now() + days * 86400000);
const past   = (days) => new Date(Date.now() - days * 86400000);

// ── Static Data ───────────────────────────────────────────────────────────────
const NICHES     = ['fashion','beauty','fitness','food','travel','tech','gaming','lifestyle','education','finance'];
const PLATFORMS  = ['instagram','youtube','tiktok','twitter','facebook'];
const INDUSTRIES = ['fashion','beauty','food_beverage','tech','health_wellness','travel','finance','education','entertainment','sports'];

const BRAND_DATA = [
  { name: 'Zara India',       company: 'Zara India Pvt Ltd',    industry: 'fashion',        city: 'Mumbai' },
  { name: 'Nykaa Brand',      company: 'Nykaa E-Retail Ltd',    industry: 'beauty',         city: 'Mumbai' },
  { name: 'Swiggy Ads',       company: 'Bundl Technologies',    industry: 'food_beverage',  city: 'Bangalore' },
  { name: 'boAt Lifestyle',   company: 'Imagine Marketing Ltd', industry: 'tech',           city: 'Delhi' },
  { name: 'MakeMyTrip',       company: 'MakeMyTrip India Ltd',  industry: 'travel',         city: 'Gurugram' },
];

const INFLUENCER_DATA = [
  { name: 'Priya Sharma',    niche: ['fashion','lifestyle'],  city: 'Mumbai',    ig: 245000, yt: 89000  },
  { name: 'Rahul Verma',     niche: ['tech','gaming'],        city: 'Bangalore', ig: 180000, yt: 320000 },
  { name: 'Ananya Singh',    niche: ['beauty','fashion'],     city: 'Delhi',     ig: 512000, yt: 0      },
  { name: 'Karan Mehta',     niche: ['fitness','health'],     city: 'Pune',      ig: 98000,  yt: 145000 },
  { name: 'Sneha Patel',     niche: ['food','lifestyle'],     city: 'Ahmedabad', ig: 76000,  yt: 55000  },
  { name: 'Arjun Nair',      niche: ['travel','lifestyle'],   city: 'Kochi',     ig: 430000, yt: 210000 },
  { name: 'Divya Reddy',     niche: ['education','finance'],  city: 'Hyderabad', ig: 62000,  yt: 890000 },
  { name: 'Vikram Joshi',    niche: ['sports','fitness'],     city: 'Chennai',   ig: 155000, yt: 78000  },
  { name: 'Meera Kapoor',    niche: ['art','lifestyle'],      city: 'Jaipur',    ig: 88000,  yt: 0      },
  { name: 'Rohan Gupta',     niche: ['gaming','tech'],        city: 'Kolkata',   ig: 210000, yt: 560000 },
];

const CAMPAIGN_TITLES = [
  'Summer Fashion Collection 2025',
  'Nykaa Beauty Fest Campaign',
  'Swiggy One Launch Promotion',
  'boAt Airdopes 500 Launch',
  'MakeMyTrip Monsoon Deals',
  'Zara New Arrivals Reel Series',
  'Nykaa Skincare Awareness Drive',
  'boAt Rockerz Fitness Edition',
];

const PITCHES = [
  'I have a highly engaged audience in this niche and have worked with similar brands before. My content style aligns perfectly with your brand identity.',
  'My followers trust my recommendations. I can create authentic content that drives real conversions for your campaign.',
  'I specialize in this category and my audience demographics match your target market exactly. Let me show you what I can do.',
  'I have previously collaborated with top brands in this space and delivered 3x the expected engagement. Would love to work with you.',
  'My content consistently gets 8-12% engagement rate which is well above industry average. I can deliver exceptional results.',
];

// ── Main Seed Function ────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/connectai');
  console.log('✅ Connected to MongoDB');

  // ── Wipe existing data ──────────────────────────────────────────────────────
  await Promise.all([
    User.deleteMany({}),
    BrandProfile.deleteMany({}),
    InfluencerProfile.deleteMany({}),
    Campaign.deleteMany({}),
    Application.deleteMany({}),
    Contract.deleteMany({}),
    Payment.deleteMany({}),
    Subscription.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    Notification.deleteMany({}),
    PlatformSettings.deleteMany({}),
  ]);
  console.log('🗑️  Cleared existing data');

  // ── Admin ───────────────────────────────────────────────────────────────────
  const admin = await User.create({
    name: 'Super Admin',
    email: 'admin@connectai.com',
    password: 'Admin@123',
    role: 'admin',
    isVerified: true,
    isProfileComplete: true,
  });
  console.log('👤 Admin created:', admin.email);

  // ── Brands ──────────────────────────────────────────────────────────────────
  const brandUsers = [];
  const brandProfiles = [];

  for (const b of BRAND_DATA) {
    const user = await User.create({
      name: b.name,
      email: `${b.name.toLowerCase().replace(/\s+/g, '.')}@brand.com`,
      password: 'Brand@123',
      role: 'brand',
      isVerified: true,
      isProfileComplete: true,
    });

    const profile = await BrandProfile.create({
      user: user._id,
      companyName: b.company,
      industry: b.industry,
      website: `https://www.${b.company.toLowerCase().replace(/\s+/g, '')}.com`,
      description: `${b.company} is a leading brand in the ${b.industry} industry, looking to connect with authentic influencers to grow our digital presence.`,
      targetAudience: 'Young adults aged 18-35 interested in lifestyle and trends',
      location: { country: 'India', city: b.city },
      isVerified: true,
      totalCampaigns: rand(2, 10),
      totalSpent: rand(50000, 500000),
    });

    brandUsers.push(user);
    brandProfiles.push(profile);
  }
  console.log(`✅ ${brandUsers.length} Brands created`);

  // ── Influencers ─────────────────────────────────────────────────────────────
  const influencerUsers = [];
  const influencerProfiles = [];

  for (const inf of INFLUENCER_DATA) {
    const user = await User.create({
      name: inf.name,
      email: `${inf.name.toLowerCase().replace(/\s+/g, '.')}@influencer.com`,
      password: 'Influencer@123',
      role: 'influencer',
      isVerified: true,
      isProfileComplete: true,
    });

    const socialAccounts = [];
    if (inf.ig > 0) {
      socialAccounts.push({
        platform: 'instagram',
        handle: `@${inf.name.toLowerCase().replace(/\s+/g, '_')}`,
        url: `https://instagram.com/${inf.name.toLowerCase().replace(/\s+/g, '_')}`,
        followers: inf.ig,
        engagementRate: parseFloat((Math.random() * 6 + 2).toFixed(2)),
        isConnected: true,
        connectedAt: past(rand(30, 180)),
      });
    }
    if (inf.yt > 0) {
      socialAccounts.push({
        platform: 'youtube',
        handle: inf.name,
        url: `https://youtube.com/@${inf.name.toLowerCase().replace(/\s+/g, '')}`,
        followers: inf.yt,
        engagementRate: parseFloat((Math.random() * 4 + 1).toFixed(2)),
        isConnected: true,
        connectedAt: past(rand(30, 180)),
      });
    }

    const totalFollowers = inf.ig + inf.yt;
    const profile = await InfluencerProfile.create({
      user: user._id,
      bio: `${inf.name} is a content creator based in ${inf.city} specializing in ${inf.niche.join(' & ')} content. Passionate about creating authentic stories that resonate.`,
      niche: inf.niche,
      location: { country: 'India', city: inf.city },
      languages: ['Hindi', 'English'],
      gender: pick(['male', 'female']),
      profileImage: `https://i.pravatar.cc/300?u=${user._id}`,
      socialAccounts,
      totalFollowers,
      avgEngagementRate: parseFloat((Math.random() * 5 + 2).toFixed(2)),
      aiScore: rand(55, 95),
      pricePerPost: rand(5000, 50000),
      pricePerStory: rand(2000, 20000),
      pricePerVideo: rand(10000, 100000),
      isVerified: Math.random() > 0.3,
      isFeatured: Math.random() > 0.7,
      totalCampaigns: rand(1, 15),
      totalEarnings: rand(20000, 300000),
    });

    influencerUsers.push(user);
    influencerProfiles.push(profile);
  }
  console.log(`✅ ${influencerUsers.length} Influencers created`);

  // ── Campaigns ───────────────────────────────────────────────────────────────
  const campaigns = [];
  const statuses = ['active', 'active', 'active', 'draft', 'in_progress', 'completed', 'draft', 'paused'];

  for (let i = 0; i < CAMPAIGN_TITLES.length; i++) {
    const brand = brandUsers[i % brandUsers.length];
    const niche = [pick(NICHES), pick(NICHES)].filter((v, idx, arr) => arr.indexOf(v) === idx);
    const platform = [pick(PLATFORMS), pick(PLATFORMS)].filter((v, idx, arr) => arr.indexOf(v) === idx);
    const budgetMin = rand(10000, 50000);

    const campaign = await Campaign.create({
      brand: brand._id,
      title: CAMPAIGN_TITLES[i],
      description: `We are looking for talented content creators to promote our latest offering. This campaign focuses on authentic storytelling and genuine product experiences. Selected influencers will receive the product and a detailed brief.`,
      niche,
      platform,
      budget: { min: budgetMin, max: budgetMin + rand(10000, 100000), currency: 'INR' },
      deliverables: [
        { type: 'post',  quantity: 2, description: '2 feed posts with brand mention and hashtags' },
        { type: 'story', quantity: 5, description: '5 stories with swipe-up link' },
        { type: 'reel',  quantity: 1, description: '1 reel showcasing the product' },
      ],
      milestones: [
        { title: 'Content Brief Shared',   dueDate: future(5),  completed: true  },
        { title: 'Draft Content Approval', dueDate: future(15), completed: false },
        { title: 'Final Post Live',        dueDate: future(25), completed: false },
      ],
      timeline: { startDate: past(rand(0, 10)), endDate: future(rand(20, 60)) },
      requirements: {
        minFollowers: rand(10000, 100000),
        minEngagementRate: parseFloat((Math.random() * 3 + 1).toFixed(1)),
        location: 'India',
        gender: pick(['male', 'female', 'any', 'any']),
        ageRange: { min: 18, max: 35 },
      },
      status: statuses[i],
      applicationsCount: rand(3, 25),
      isAdminApproved: true,
      isFeatured: Math.random() > 0.6,
      tags: niche,
    });

    campaigns.push(campaign);
  }
  console.log(`✅ ${campaigns.length} Campaigns created`);

  // ── Applications ─────────────────────────────────────────────────────────────
  const applications = [];
  const appStatuses = ['pending', 'pending', 'accepted', 'accepted', 'rejected'];
  const usedPairs = new Set();

  for (let i = 0; i < 12; i++) {
    const campaign = campaigns[i % campaigns.length];
    const influencer = influencerUsers[i % influencerUsers.length];
    const pairKey = `${campaign._id}-${influencer._id}`;
    if (usedPairs.has(pairKey)) continue;
    usedPairs.add(pairKey);

    const status = pick(appStatuses);
    const app = await Application.create({
      campaign: campaign._id,
      influencer: influencer._id,
      pitch: pick(PITCHES),
      status,
      brandNote: status === 'rejected' ? 'Thank you for applying. We have selected other creators for this campaign.' : '',
      respondedAt: status !== 'pending' ? past(rand(1, 10)) : undefined,
    });
    applications.push(app);
  }
  console.log(`✅ ${applications.length} Applications created`);

  // ── Contracts ────────────────────────────────────────────────────────────────
  const contracts = [];
  const acceptedApps = applications.filter(a => a.status === 'accepted').slice(0, 4);

  for (const app of acceptedApps) {
    const campaign = campaigns.find(c => c._id.equals(app.campaign));
    const contractStatus = pick(['active', 'active', 'completed', 'pending_influencer']);
    const isSigned = contractStatus === 'active' || contractStatus === 'completed';

    const contract = await Contract.create({
      campaign: app.campaign,
      brand: campaign.brand,
      influencer: app.influencer,
      title: `Contract — ${campaign.title}`,
      terms: `This agreement is between the Brand and the Influencer for the campaign "${campaign.title}". The Influencer agrees to create and publish the agreed deliverables within the specified timeline. All content must be original, authentic, and comply with platform guidelines and applicable advertising standards.`,
      deliverables: [
        { description: '2 Instagram feed posts',  platform: 'instagram', dueDate: future(15), quantity: 2 },
        { description: '5 Instagram stories',     platform: 'instagram', dueDate: future(10), quantity: 5 },
        { description: '1 Instagram reel',        platform: 'instagram', dueDate: future(20), quantity: 1 },
      ],
      compensation: {
        amount: rand(15000, 80000),
        currency: 'INR',
        paymentTerms: '50% upfront, 50% on completion',
      },
      timeline: { startDate: past(5), endDate: future(25) },
      status: contractStatus,
      brandSignature: { signed: isSigned, signedAt: isSigned ? past(rand(1, 5)) : undefined },
      influencerSignature: { signed: isSigned, signedAt: isSigned ? past(rand(1, 4)) : undefined },
      exclusivity: Math.random() > 0.7,
      usageRights: 'Brand may use the content for 6 months across all digital platforms.',
      cancellationPolicy: 'Either party may cancel with 7 days written notice before content creation begins.',
    });
    contracts.push(contract);
  }
  console.log(`✅ ${contracts.length} Contracts created`);

  // ── Payments ─────────────────────────────────────────────────────────────────
  const payments = [];
  const payStatuses = ['escrow_held', 'released', 'released', 'pending'];

  for (let i = 0; i < contracts.length; i++) {
    const contract = contracts[i];
    const amount = contract.compensation.amount;
    const fee = Math.round(amount * 0.1);

    const payment = await Payment.create({
      campaign: contract.campaign,
      brand: contract.brand,
      influencer: contract.influencer,
      contract: contract._id,
      amount,
      currency: 'INR',
      platformFee: fee,
      platformFeePercent: 10,
      influencerPayout: amount - fee,
      razorpayOrderId: `order_seed_${Date.now()}_${i}`,
      razorpayPaymentId: `pay_seed_${Date.now()}_${i}`,
      status: payStatuses[i],
      type: 'escrow',
      releasedAt: payStatuses[i] === 'released' ? past(rand(1, 5)) : null,
      payoutStatus: payStatuses[i] === 'released' ? 'completed' : 'pending',
      description: `Escrow payment for ${contract.title}`,
    });
    payments.push(payment);
  }
  console.log(`✅ ${payments.length} Payments created`);

  // ── Subscriptions ─────────────────────────────────────────────────────────────
  const subData = [
    { user: brandUsers[0], plan: 'pro',        role: 'brand',      price: 2999,  interval: 'monthly' },
    { user: brandUsers[1], plan: 'enterprise', role: 'brand',      price: 9999,  interval: 'monthly' },
    { user: influencerUsers[0], plan: 'pro',   role: 'influencer', price: 999,   interval: 'monthly' },
  ];

  for (const s of subData) {
    await Subscription.create({
      user: s.user._id,
      plan: s.plan,
      role: s.role,
      status: 'active',
      price: s.price,
      currency: 'INR',
      interval: s.interval,
      startDate: past(rand(10, 30)),
      endDate: future(rand(20, 335)),
      autoRenew: true,
      limits: {
        maxCampaigns: s.plan === 'enterprise' ? 999 : 10,
        maxApplications: s.plan === 'pro' ? 50 : 10,
        maxShortlists: s.plan === 'enterprise' ? 999 : 5,
        featuredListing: s.plan !== 'free',
        advancedAnalytics: s.plan !== 'free',
        prioritySupport: s.plan === 'enterprise',
      },
      paymentHistory: [{
        amount: s.price,
        paidAt: past(rand(10, 30)),
        razorpayPaymentId: `pay_sub_seed_${Date.now()}`,
        status: 'success',
      }],
    });
  }
  console.log('✅ 3 Subscriptions created');

  // ── Conversations + Messages ──────────────────────────────────────────────────
  const convPairs = [
    [brandUsers[0], influencerUsers[0], campaigns[0]],
    [brandUsers[1], influencerUsers[2], campaigns[1]],
    [brandUsers[2], influencerUsers[4], campaigns[2]],
    [brandUsers[3], influencerUsers[1], campaigns[3]],
    [brandUsers[4], influencerUsers[6], campaigns[4]],
  ];

  for (const [brand, influencer, campaign] of convPairs) {
    const conv = await Conversation.create({
      participants: [brand._id, influencer._id],
      campaign: campaign._id,
      isActive: true,
      unreadCounts: new Map([[brand._id.toString(), 0], [influencer._id.toString(), 1]]),
    });

    const msgTexts = [
      `Hi! I saw your campaign "${campaign.title}" and I'm very interested in collaborating.`,
      `Thanks for reaching out! Your profile looks great. Can you share your media kit?`,
      `Sure! I'll send it over. My engagement rate is consistently above 6% on Instagram.`,
      `That's impressive. We'd love to move forward. Let's discuss the deliverables.`,
      `Sounds great! Looking forward to working together on this campaign.`,
    ];

    let lastMsg = null;
    for (let m = 0; m < msgTexts.length; m++) {
      const sender = m % 2 === 0 ? influencer : brand;
      const msg = await Message.create({
        conversation: conv._id,
        sender: sender._id,
        text: msgTexts[m],
        readBy: [{ user: sender._id, readAt: new Date() }],
        messageType: 'text',
        createdAt: past(5 - m),
      });
      lastMsg = msg;
    }

    await Conversation.findByIdAndUpdate(conv._id, {
      lastMessage: { text: lastMsg.text, sender: lastMsg.sender, createdAt: lastMsg.createdAt },
      updatedAt: lastMsg.createdAt,
    });
  }
  console.log('✅ 5 Conversations + Messages created');

  // ── Notifications ─────────────────────────────────────────────────────────────
  const notifData = [
    // Influencer notifications
    ...influencerUsers.slice(0, 5).map((u, i) => ({
      user: u._id,
      type: 'invitation',
      title: 'New Campaign Invitation',
      body: `You've been invited to collaborate on "${campaigns[i % campaigns.length].title}". Check it out!`,
      data: { screen: 'CampaignDetail', referenceId: campaigns[i % campaigns.length]._id.toString(), referenceType: 'campaign' },
    })),
    ...influencerUsers.slice(0, 4).map((u, i) => ({
      user: u._id,
      type: 'application_status',
      title: applications[i]?.status === 'accepted' ? 'Application Accepted 🎉' : 'Application Update',
      body: applications[i]?.status === 'accepted'
        ? 'Congratulations! Your application has been accepted.'
        : 'Your application status has been updated.',
      data: { screen: 'MyApplications', referenceId: applications[i]?._id?.toString(), referenceType: 'application' },
      read: Math.random() > 0.5,
    })),
    // Brand notifications
    ...brandUsers.slice(0, 5).map((u, i) => ({
      user: u._id,
      type: 'application',
      title: 'New Application Received',
      body: `${influencerUsers[i % influencerUsers.length].name} has applied to your campaign.`,
      data: { screen: 'CampaignApplicants', referenceId: campaigns[i % campaigns.length]._id.toString(), referenceType: 'campaign' },
    })),
    // Payment notifications
    ...brandUsers.slice(0, 3).map((u, i) => ({
      user: u._id,
      type: 'payment',
      title: 'Payment Confirmed',
      body: 'Your escrow payment has been successfully held. Campaign can now begin.',
      data: { screen: 'Payments', referenceId: payments[i]?._id?.toString(), referenceType: 'payment' },
      read: true,
    })),
    // Message notifications
    ...influencerUsers.slice(0, 3).map((u, i) => ({
      user: u._id,
      type: 'message',
      title: 'New Message',
      body: `${brandUsers[i].name} sent you a message.`,
      data: { screen: 'Chat', referenceType: 'conversation' },
    })),
  ];

  await Notification.insertMany(notifData.map(n => ({
    ...n,
    read: n.read ?? false,
    readAt: n.read ? past(rand(1, 3)) : null,
    pushSent: true,
  })));
  console.log(`✅ ${notifData.length} Notifications created`);

  // ── Platform Settings ─────────────────────────────────────────────────────────
  await PlatformSettings.create({
    key: 'global',
    commissionRate: 10,
    minWithdrawal: 500,
    maxWithdrawal: 500000,
    featureFlags: {
      aiMatching: true,
      aiScoring: true,
      aiChatAssistant: true,
      aiContentAnalysis: true,
      aiBriefGenerator: true,
      affiliateSystem: true,
      featuredListings: true,
      adCampaigns: true,
      socialMediaSync: true,
      pushNotifications: true,
      emailNotifications: true,
      escrowPayments: true,
    },
    maintenanceMode: false,
    updatedBy: admin._id,
  });
  console.log('✅ PlatformSettings created');

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌱 Seed complete! Login credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Admin      → admin@connectai.com       / Admin@123');
  console.log('  Brand      → zara.india@brand.com      / Brand@123');
  console.log('  Influencer → priya.sharma@influencer.com / Influencer@123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
