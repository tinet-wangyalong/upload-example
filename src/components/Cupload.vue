<template>
  <div id="app">
    <div>
      <input type="file" @change="handleFileChange" />
      <el-button @click="handleUpload">upload</el-button>
      <el-button @click="handleResume">resume</el-button>
      <el-button @click="handlePause">pause</el-button>
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
import { computed, defineComponent, reactive } from "vue";
import { request } from "./tool";

export default defineComponent({
  name: "cUpload",
  setup() {
    const info = reactive({
      container: {
        file: null as any,
        hash: "" as any,
        worker: null as any,
      },
      status: "wait",
      hashPercentage: 0, // 上传进度
      fileData: [] as any,
      requestList: [],
    });

    const transformByte = computed(() => {
      return (val: number) => {
        return Number((val / 1024).toFixed(0));
      };
    });

    // const resetData = () => {
    //   this.requestList.forEach(xhr => xhr?.abort());
    //   this.requestList = [];
    //   if (this.container.worker) {
    //     this.container.worker.onmessage = null;
    //   }
    // };
    // 获取文件
    const handleFileChange = (e: any) => {
      const [file] = e.target.files;
      if (!file) return;
      // resetData();
      // Object.assign(this.$data, this.$options.data());
      info.container.file = file;
    };

    // 生成文件切片
    // create file chunk
    const createFileChunk = (file: any, size = 10 * 1024 * 1024) => {
      const fileChunkList = [];
      let cur = 0;
      while (cur < file.size) {
        fileChunkList.push({ file: file.slice(cur, cur + size) });
        cur += size;
      }
      return fileChunkList;
    };
    // 生成文件 hash（web-worker）
    // use web-worker to calculate hash
    const calculateHash = (fileChunkList: { file: any }[]) => {
      return new Promise((resolve) => {
        info.container.worker = new Worker("/third/hash.js");
        info.container.worker.postMessage({ fileChunkList });
        info.container.worker.onmessage = (e: any) => {
          const { percentage, hash } = e.data;
          info.hashPercentage = percentage;
          if (hash) {
            resolve(hash);
          }
        };
      });
    };
    // 根据 hash 验证文件是否曾经已经被上传过
    // 没有才进行上传
    const verifyUpload = async (filename: any, fileHash: any) => {
      const { data } = await request({
        url: "http://localhost:3003/verify",
        headers: {
          "content-type": "application/json",
        },
        data: JSON.stringify({
          filename,
          fileHash,
        }),
      });
      return JSON.parse(data);
    };
    const handleUpload = async () => {
      if (!info.container.file) return;
      info.status = "upload";
      // 文件切片
      const fileChunkList = createFileChunk(info.container.file);
      // 文件的进度和hash
      info.container.hash = await calculateHash(fileChunkList);

      const { shouldUpload, uploadedList } = await verifyUpload(
        info.container.file.name,
        info.container.hash
      );

      if (!shouldUpload) {
        alert("跳过上传：文件上传成功，查看/目标目录");
        info.status = "wait";
        return;
      }

      info.fileData = fileChunkList.map(({ file }, index) => ({
        fileHash: info.container.hash,
        index,
        hash: info.container.hash + "-" + index,
        chunk: file,
        size: file.size,
        percentage: uploadedList.includes(index) ? 100 : 0,
      }));

      await uploadChunks(uploadedList);
    };
    // 用闭包保存每个 chunk 的进度数据
    const createProgressHandler = (item: { percentage: number }) => {
      return (e: { loaded: number; total: number }) => {
        item.percentage = parseInt(String((e.loaded / e.total) * 100));
      };
    };
    // 通知服务端合并切片
    const mergeRequest = async () => {
      await request({
        url: "http://localhost:3003/merge",
        headers: {
          "content-type": "application/json",
        },
        data: JSON.stringify({
          size: 10 * 1024 * 1024,
          fileHash: info.container.hash,
          filename: info.container.file.name,
        }),
      });
      alert("文件上传成功，查看/目标目录");
      info.status = "wait";
    };

    // 上传切片，同时过滤已上传的切片
    const uploadChunks = async (uploadedList = []) => {
      const requestList = info.fileData
        .filter(({ hash }: never) => !uploadedList.includes(hash))
        .map(({ chunk, hash, index }: any) => {
          const formData = new FormData();
          formData.append("chunk", chunk);
          formData.append("hash", hash);
          formData.append("filename", info.container.file.name);
          formData.append("fileHash", info.container.hash);
          return { formData, index };
        })
        .map(({ formData, index }: any) =>
          request({
            url: "http://localhost:3003",
            data: formData,
            onProgress: createProgressHandler(info.fileData[index]),
            requestList: info.requestList,
          })
        );
      await Promise.all(requestList);
      console.log(uploadedList);
      console.log(requestList);
      console.log(info.fileData);
      if (uploadedList.length + requestList.length === info.fileData.length) {
        await mergeRequest();
      }
    };

    const handleResume = () => {
      console.log(2222);
    };

    const handlePause = () => {
      console.log(3333);
    };

    const handleDelete = () => {
      console.log(4444);
    };

    return {
      transformByte,
      handleFileChange,
      handleUpload,
      handleResume,
      handlePause,
      handleDelete,
    };
  },
});
</script>

<style lang="less" scoped></style>
