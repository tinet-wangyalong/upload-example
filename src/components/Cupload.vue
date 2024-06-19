<template>
  <div id="app">
    <div>
      <input
        type="file"
        :disabled="status !== Status.wait"
        @change="handleFileChange"
      />
      <el-button @click="handleUpload" :disabled="uploadDisabled"
        >upload</el-button
      >
      <el-button @click="handleResume" v-if="status === Status.pause"
        >resume</el-button
      >
      <el-button
        v-else
        :disabled="status !== Status.uploading || !container.hash"
        @click="handlePause"
        >pause</el-button
      >
      <el-button @click="handleDelete">delete</el-button>
    </div>
    <!-- <div>
      <div>
        <div>calculate chunk hash</div>
        <el-progress :percentage="hashPercentage"></el-progress>
      </div>
      <div>
        <div>percentage</div>
        <el-progress :percentage="fakeUploadPercentage"></el-progress>
      </div>
    </div>
    <el-table :data="data">
      <el-table-column
        prop="hash"
        label="chunk hash"
        align="center"
      ></el-table-column>
      <el-table-column label="size(KB)" align="center" width="120">
        <template v-slot="{ row }">
          {{ transformByte.value(row.size) }}
        </template>
      </el-table-column>
      <el-table-column label="percentage" align="center">
        <template v-slot="{ row }">
          <el-progress
            :percentage="row.percentage"
            color="#909399"
          ></el-progress>
        </template>
      </el-table-column>
    </el-table> -->
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from "vue";

export default defineComponent({
  name: "cUpload",
  setup() {
    const transformByte = computed(() => {
      return (val: number) => {
        return Number((val / 1024).toFixed(0));
      };
    });

    return {
      transformByte,
    };
  },
});
</script>

<style lang="less" scoped></style>
