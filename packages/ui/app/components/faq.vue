<template>
  <section class="bg-paper text-ink border-t border-mist">
    <div class="container px-6 pt-16 pb-8 xl:pt-20 xl:pb-10">

      <div class="mb-12">
        <h2 class="text-2xl font-semibold tracking-tight mb-6">
          How This Service Runs
        </h2>

        <p class="text-lg text-neutral-500 leading-relaxed max-w-prose">
          This service is <strong class="text-ink">free</strong> and
          <strong class="text-ink">open-source</strong>, and I intend to
          keep it that way.<br>
          For now, everything runs on
          <strong class="text-accent">one small server</strong> I pay
          for myself, so speed and availability are a bit limited —
          here's what that means for you:
        </p>
      </div>

      <div class="grid gap-px bg-mist border border-mist md:grid-cols-3">
        <div class="bg-paper p-8">
          <h3 class="font-semibold mb-3">
            Upload limits
          </h3>
          <ul class="text-neutral-500 leading-relaxed space-y-1">
            <li>Max height: <strong class="text-ink">720p</strong></li>
            <li>Max duration: <strong class="text-ink">5 minutes</strong></li>
          </ul>
        </div>

        <div class="bg-paper p-8">
          <h3 class="font-semibold mb-3">
            Queue system
          </h3>
          <ul class="text-neutral-500 leading-relaxed space-y-1">
            <li>One video processed at a time</li>
            <li>Leaving the page for <strong class="text-ink">1 minute</strong> cancels your job</li>
          </ul>
        </div>

        <div class="bg-paper p-8">
          <h3 class="font-semibold mb-3">
            Storage
          </h3>
          <ul class="text-neutral-500 leading-relaxed space-y-1">
            <li>A new upload deletes your previous video</li>
            <li>Downloads available for <strong class="text-ink">24 hours</strong></li>
          </ul>
        </div>
      </div>

    </div>
  </section>
</template>
