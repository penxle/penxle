<script lang="ts">
  import { graphql } from '$glitch';
  import Editor from './Editor.svelte';

  $: query = graphql(`
    query EditorPermalinkPage_Query($permalink: String!) {
      ...EditorPage_Editor_query

      draftPost(permalink: $permalink) {
        id
        ...EditorPage_Editor_post
      }
    }
  `);
</script>

{#key $query.draftPost.id}
  <Editor $post={$query.draftPost} {$query} />
{/key}
