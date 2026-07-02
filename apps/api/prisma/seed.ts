import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';

export interface SeedSummary {
  users: number;
  follows: number;
  tweets: number;
  likes: number;
  notifications: number;
}

const DEMO_PASSWORD = 'Flock123!';

interface UserFixture {
  username: string;
  displayName: string;
  bio: string;
}

// 8 fixed demo users. Order matters: it drives tweet staggering and the
// deterministic like-rotation below, so don't reorder without re-checking
// the dataset totals documented in openspec/changes/07-seed/specs/seed/spec.md.
const USER_FIXTURES: UserFixture[] = [
  { username: 'ada', displayName: 'Ada Lovelace', bio: 'Analytical engine enthusiast.' },
  { username: 'linus', displayName: 'Linus Torvalds', bio: 'Kernel tinkerer.' },
  { username: 'grace', displayName: 'Grace Hopper', bio: 'Compiler pioneer. Bugs beware.' },
  {
    username: 'margaret',
    displayName: 'Margaret Hamilton',
    bio: 'Software engineering, before it had a name.',
  },
  { username: 'alan', displayName: 'Alan Turing', bio: 'Thinking about machines that think.' },
  { username: 'barbara', displayName: 'Barbara Liskov', bio: 'Substitutable by design.' },
  { username: 'dennis', displayName: 'Dennis Ritchie', bio: 'Pointers and portable systems.' },
  {
    username: 'katherine',
    displayName: 'Katherine Johnson',
    bio: 'Trajectories, by hand and by machine.',
  },
];

const USERNAMES = USER_FIXTURES.map((u) => u.username);

// ada -> 5 followees. Combined with the per-author tweet counts below, this
// makes ada's timeline (self + followees) come out to exactly 36 tweets.
const FOLLOW_EDGES: Array<[string, string]> = [
  ['ada', 'linus'],
  ['ada', 'grace'],
  ['ada', 'margaret'],
  ['ada', 'alan'],
  ['ada', 'barbara'],
  ['linus', 'grace'],
  ['linus', 'margaret'],
  ['linus', 'dennis'],
  ['grace', 'alan'],
  ['grace', 'barbara'],
  ['grace', 'katherine'],
  ['margaret', 'ada'],
  ['margaret', 'dennis'],
  ['alan', 'barbara'],
  ['alan', 'katherine'],
  ['barbara', 'ada'],
  ['barbara', 'linus'],
  ['dennis', 'ada'],
  ['dennis', 'katherine'],
  ['katherine', 'ada'],
];

// 45 tweets total, grouped by author in fixture order: ada=7, linus=6,
// grace=6, margaret=6, alan=6, barbara=5, dennis=5, katherine=4.
// Grouping by author (rather than interleaving) means ada's eligible
// timeline authors (ada + her 5 followees) occupy a contiguous block of the
// first 36 tweets, which is what makes the 36-tweet timeline depth exact.
const TWEET_COUNTS_BY_AUTHOR: Record<string, number> = {
  ada: 7,
  linus: 6,
  grace: 6,
  margaret: 6,
  alan: 6,
  barbara: 5,
  dennis: 5,
  katherine: 4,
};

const TWEET_CONTENT_BY_AUTHOR: Record<string, string[]> = {
  ada: [
    'The Analytical Engine has no pretensions to originate anything.',
    'Notes, notes, and more notes. This one might be my longest yet.',
    'Working through a new algorithm today. Feels like poetry in numbers.',
    'Imagination is the discovering faculty, pre-eminently.',
    'Weaving patterns like the Jacquard loom, but in logic.',
    'A calculating engine that composes music? Someday.',
    'Late night with punch cards and coffee.',
  ],
  linus: [
    'Talk is cheap. Show me the code.',
    'Merged another patch series. Kernel keeps growing.',
    'Just released a new tag. Changelog is long this time.',
    'Bikeshedding on mailing lists never gets old.',
    'Given enough eyeballs, all bugs are shallow.',
    'Rebasing my life choices, one commit at a time.',
  ],
  grace: [
    'Found an actual moth in the relay today. Debugging, literally.',
    'A ship in port is safe, but that is not what ships are built for.',
    'Compilers should write programs, not just translate them.',
    'It is easier to ask forgiveness than it is to get permission.',
    'Teaching the machine to understand English, one keyword at a time.',
    'Standards matter. So does moving fast.',
  ],
  margaret: [
    'Software engineering is a discipline, not an afterthought.',
    'Priority displays saved the mission. Error handling matters.',
    'There was no choice but to be pioneers.',
    'Margin for error is not the same as no error.',
    'Documentation is a love letter to your future self.',
    'Systems thinking beats heroics every time.',
  ],
  alan: [
    'Can machines think? I keep asking the wrong question, maybe.',
    'Sometimes the person who no one imagines anything of does the impossible.',
    'A universal machine that simulates any other machine. Wild idea.',
    'Cracked another puzzle today. On to the next one.',
    'Mathematics and mechanism, always intertwined.',
    'The imitation game is more interesting than the answer.',
  ],
  barbara: [
    'If it looks like a duck and quacks like a duck, substitute freely.',
    'Abstraction is not hiding complexity, it is managing it.',
    'Data abstraction changed how I think about programs entirely.',
    'Good interfaces age well. Good implementations still need care.',
    'Contracts between modules matter more than clever tricks.',
  ],
  dennis: [
    'C is quirky, flawed, and an enormous success.',
    'UNIX is simple. It just takes a genius to understand its simplicity.',
    'Portable operating systems are worth the extra effort.',
    'Wrote a manual page today. Someone will thank me later.',
    'Pointers are not scary once you draw the boxes and arrows.',
  ],
  katherine: [
    'Get the odds, get the calculations right, get us home.',
    'Double-checked the trajectory by hand again. Trust, but verify.',
    'Numbers do not lie, but they do need careful handling.',
    'Every launch window is a math problem wearing a countdown clock.',
  ],
};

interface TweetFixture {
  authorUsername: string;
  content: string;
}

const TWEET_FIXTURES: TweetFixture[] = USERNAMES.flatMap((username) =>
  TWEET_CONTENT_BY_AUTHOR[username]
    .slice(0, TWEET_COUNTS_BY_AUTHOR[username])
    .map((content) => ({ authorUsername: username, content })),
);

// Deterministic like counts per tweet index (0-44), aligned with the
// author-grouped TWEET_FIXTURES order above. Sums to 60; every value is
// within the 0-6 range required by the spec.
const LIKE_COUNTS: number[] = [
  // ada (0-6)
  2, 1, 3, 0, 4, 2, 1,
  // linus (7-12)
  1, 2, 0, 3, 1, 2,
  // grace (13-18)
  2, 0, 1, 3, 2, 1,
  // margaret (19-24)
  0, 2, 4, 1, 0, 2,
  // alan (25-30)
  1, 0, 3, 0, 2, 1,
  // barbara (31-35)
  2, 1, 0, 3, 1,
  // dennis (36-40)
  0, 1, 2, 0, 1,
  // katherine (41-44)
  1, 1, 0, 0,
];

const MINUTES_PER_TWEET = 90;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Deterministically picks `count` likers for the tweet at `tweetIndex`,
 * excluding its author. Rotates the fixed username order by `tweetIndex`
 * so different tweets get different (but reproducible) liker sets — no
 * randomness, per D4 in the seed design.
 */
function likersFor(tweetIndex: number, authorUsername: string, count: number): string[] {
  const candidates = USERNAMES.filter((username) => username !== authorUsername);
  const offset = tweetIndex % candidates.length;
  const rotated = [...candidates.slice(offset), ...candidates.slice(0, offset)];
  return rotated.slice(0, count);
}

export async function seed(prisma: PrismaClient): Promise<SeedSummary> {
  // Wipe in FK-safe order (mirrors the reset order used in the e2e specs
  // under apps/api/test, e.g. likes.e2e-spec.ts's afterEach hook).
  await prisma.notification.deleteMany();
  await prisma.like.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.tweet.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hash(DEMO_PASSWORD);

  const users = await Promise.all(
    USER_FIXTURES.map((fixture) =>
      prisma.user.create({
        data: {
          email: `${fixture.username}@theflock.dev`,
          username: fixture.username,
          passwordHash,
          displayName: fixture.displayName,
          bio: fixture.bio,
        },
      }),
    ),
  );
  const userIdByUsername = new Map(users.map((user) => [user.username, user.id]));

  const followResult = await prisma.follow.createMany({
    data: FOLLOW_EDGES.map(([followerUsername, followingUsername]) => ({
      followerId: userIdByUsername.get(followerUsername)!,
      followingId: userIdByUsername.get(followingUsername)!,
    })),
  });

  const base = Date.now() - SEVEN_DAYS_MS;
  const tweets = await Promise.all(
    TWEET_FIXTURES.map((fixture, index) =>
      prisma.tweet.create({
        data: {
          authorId: userIdByUsername.get(fixture.authorUsername)!,
          content: fixture.content,
          createdAt: new Date(base + index * MINUTES_PER_TWEET * 60 * 1000),
        },
      }),
    ),
  );

  const likeRows = tweets.flatMap((tweet, index) =>
    likersFor(index, TWEET_FIXTURES[index].authorUsername, LIKE_COUNTS[index]).map(
      (likerUsername) => ({
        userId: userIdByUsername.get(likerUsername)!,
        tweetId: tweet.id,
      }),
    ),
  );
  const likeResult = await prisma.like.createMany({ data: likeRows });

  // Demo reply thread: appended after the main 45-tweet dataset (rather than
  // interleaved) so it never disturbs the author-grouped ordering the comments
  // above document — it exists purely so the thread UI (/t/:id) has something
  // to show out of the box.
  const threadBase = base + TWEET_FIXTURES.length * MINUTES_PER_TWEET * 60 * 1000;
  const replyRoot = await prisma.tweet.create({
    data: {
      authorId: userIdByUsername.get('ada')!,
      content: "What's everyone hacking on this week?",
      createdAt: new Date(threadBase),
    },
  });
  const REPLY_FIXTURES: Array<{ authorUsername: string; content: string }> = [
    { authorUsername: 'linus', content: 'Reviewing kernel patches, as always.' },
    { authorUsername: 'grace', content: 'Debugging a stubborn compiler edge case.' },
    { authorUsername: 'margaret', content: 'Writing error-handling specs for a new system.' },
  ];
  const replies = await Promise.all(
    REPLY_FIXTURES.map((fixture, index) =>
      prisma.tweet.create({
        data: {
          authorId: userIdByUsername.get(fixture.authorUsername)!,
          content: fixture.content,
          parentId: replyRoot.id,
          createdAt: new Date(threadBase + (index + 1) * 60 * 1000),
        },
      }),
    ),
  );
  const totalTweets = tweets.length + 1 + replies.length;

  // Demo notifications for ada, derived from the rows seeded above so links
  // resolve to real content: her thread's replies, one like, two followers.
  // Raw rows (not service fan-out) because the seed writes prisma directly.
  const adaId = userIdByUsername.get('ada')!;
  const adaFirstTweet = tweets[TWEET_FIXTURES.findIndex((f) => f.authorUsername === 'ada')];
  const adaFirstLiker = likeRows.find((row) => row.tweetId === adaFirstTweet.id);
  const notificationRows = [
    ...replies.map((reply, index) => ({
      type: 'REPLY' as const,
      actorId: reply.authorId,
      recipientId: adaId,
      tweetId: reply.id,
      read: false,
      createdAt: new Date(threadBase + (index + 1) * 60 * 1000),
    })),
    ...(adaFirstLiker
      ? [
          {
            type: 'LIKE' as const,
            actorId: adaFirstLiker.userId,
            recipientId: adaId,
            tweetId: adaFirstTweet.id,
            read: true,
            createdAt: new Date(base),
          },
        ]
      : []),
    ...['margaret', 'barbara'].map((follower, index) => ({
      type: 'FOLLOW' as const,
      actorId: userIdByUsername.get(follower)!,
      recipientId: adaId,
      read: true,
      createdAt: new Date(base + index * 60 * 1000),
    })),
  ];
  const notificationResult = await prisma.notification.createMany({ data: notificationRows });

  return {
    users: users.length,
    follows: followResult.count,
    tweets: totalTweets,
    likes: likeResult.count,
    notifications: notificationResult.count,
  };
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run the demo seed script against NODE_ENV=production.');
    process.exit(1);
    return;
  }

  const prisma = new PrismaClient();
  try {
    const summary = await seed(prisma);
    console.log('Seed complete:', summary);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
