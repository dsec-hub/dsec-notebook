<script lang="ts">
	import { page } from "$app/state";
	import UnitPage from "../units/[code]/+page.svelte";
</script>

{#key page.params.code}
	<UnitPage />
{/key}
