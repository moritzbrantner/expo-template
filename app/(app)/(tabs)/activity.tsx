import { Link, type Href } from 'expo-router';

import { InlineMessage, ScreenScroll, SectionCard } from '@/components/social/ui';
import { ThemedText } from '@/components/themed-text';
import { useActivityQuery } from '@/lib/social-hooks';

export default function ActivityScreen() {
  const activityQuery = useActivityQuery();

  return (
    <ScreenScroll
      title="Activity"
      description="Follow events involving the signed-in user, including people you followed and people who followed you.">
      {activityQuery.isPending ? (
        <InlineMessage tone="muted" message="Loading activity..." />
      ) : activityQuery.isError ? (
        <InlineMessage
          tone="error"
          message={activityQuery.error instanceof Error ? activityQuery.error.message : 'Unable to load activity.'}
        />
      ) : (activityQuery.data?.activity.length ?? 0) === 0 ? (
        <InlineMessage tone="muted" message="No activity yet. Follow someone from Discover to start the feed." />
      ) : (
        activityQuery.data?.activity.map((item) => (
          <SectionCard key={`${item.type}-${item.profile.id}-${item.createdAt}`}>
            <ThemedText type="subtitle">
              {item.type === 'followed_you' ? 'New follower' : 'You followed someone'}
            </ThemedText>
            <ThemedText>
              {item.type === 'followed_you'
                ? `@${item.profile.username} followed you`
                : `You followed @${item.profile.username}`}
            </ThemedText>
            <ThemedText>{new Date(item.createdAt).toLocaleString()}</ThemedText>
            <Link href={`/u/${item.profile.username}` as Href}>Open profile</Link>
          </SectionCard>
        ))
      )}
    </ScreenScroll>
  );
}
