<template>
  <section class="bg-gray-100">
    <div class="container px-4 py-12 xl:py-28">
      <div class="space-y-4 leading-loose sm:text-lg md:text-xl lg:text-2xl">
        <p>
          This service is
          <span class="underline">free</span> and
          <span class="underline">open-source</span> and
          I intend to keep it this way and continue to improve it whenever I can.
        </p>

        <p>
          However, at the moment, the availability and speed of the service is a bit limited due to not having a better server.
        </p>

        <p>
          So what does this mean?
        </p>
      </div>

      <div class="p-5 mt-5 bg-white rounded shadow md:p-8 lg:mt-10 lg:p-10">
        <h2 class="text-lg font-bold tracking-wider md:text-xl lg:text-2xl">
          Upload limitations:
        </h2>

        <ul class="mt-2 space-y-2 text-sm leading-relaxed list-disc sm:mt-4 md:leading-loose lg:text-base lg:leading-loose xl:text-lg xl:leading-loose">
          <li>
            The max supported video height is only currently <strong>720p</strong>.
          </li>

          <li>
            The max supported video duration is only currently <strong>5 minutes</strong>.
          </li>
        </ul>
      </div>

      <div class="p-5 mt-5 bg-white rounded shadow md:p-8 lg:mt-10 lg:p-10">
        <h2 class="text-lg font-bold tracking-wider md:text-xl lg:text-2xl">
          Queue System:
        </h2>

        <ul class="mt-2 space-y-2 text-sm leading-relaxed list-disc sm:mt-4 md:leading-loose lg:text-base lg:leading-loose xl:text-lg xl:leading-loose">
          <li>
            A queue has to be implemented because the server can only process one video at a time.
          </li>

          <li>
            The user has to keep this website open until the video finished processing.
            After 1 minute of being missing, the process will be cancelled to conserve resources.
          </li>
        </ul>
      </div>

      <div class="p-5 mt-5 bg-white rounded shadow md:p-8 lg:mt-10 lg:p-10">
        <h2 class="text-lg font-bold tracking-wider md:text-xl lg:text-2xl">
          Storage limitation:
        </h2>

        <ul class="mt-2 space-y-2 text-sm leading-relaxed list-disc sm:mt-4 md:leading-loose lg:text-base lg:leading-loose xl:text-lg xl:leading-loose">
          <li>
            After a video is processed, uploading another will delete the previous one to save space.
          </li>

          <li>
            The video will only be available for download <strong>1 day</strong> after processing.
          </li>
        </ul>
      </div>

      <div class="mt-5 p-5 md:p-8 lg:p-10 lg:mt-10 bg-[#3C8CE7] text-white rounded shadow leading-relaxed">
        <p class="text-xl font-bold tracking-wider lg:text-2xl">
          You can help!
        </p>

        <p class="mt-4 lg:text-xl">
          Help me buy/maintain a good server by donating to my Ko-fi page.
        </p>

        <p class="mt-4 lg:text-xl">
          Even a small amount of $3 will help.
        </p>

        <div class="text-center sm:text-left">
          <a
            class="inline-block mt-8"
            href="https://ko-fi.com/Y8Y7D48SS"
            target="_blank"
          >
            <img
              height="56"
              style="height:56px;"
              src="https://cdn.ko-fi.com/cdn/kofi3.png?v=3"
              alt="Buy Me a Coffee at ko-fi.com"
            >
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
