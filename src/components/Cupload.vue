<template>
  <div id="app">
    <div>
      <input type="file" @change="handleFileChange" />
      <el-button @click="handleUpload">upload</el-button>
      <el-button @click="handleResume">resume</el-button>
      <el-button @click="handlePause">pause</el-button>
      <el-button @click="handleDelete">delete</el-button>
    </div>
    <div>
      <div>
        <div>上传进度</div>
        <el-progress :percentage="info.hashPercentage"></el-progress>
      </div>
    </div>
    <el-table :data="info.fileData">
      <el-table-column
        prop="hash"
        label="chunk hash"
        align="center"
      ></el-table-column>
      <el-table-column label="size(KB)" align="center" width="120">
        <template v-slot="{ row }">
          {{ transformByte(row.size) }}
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
    </el-table>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, reactive } from "vue";
import { ElMessage } from "element-plus";
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

    const resetData = () => {
      info.requestList.forEach((xhr: any) => xhr?.abort());
      info.requestList = [];
      if (info.container.worker) {
        info.container.worker.onmessage = null;
      }
    };
    // 获取文件
    const handleFileChange = (e: any) => {
      const [file] = e.target.files;
      if (!file) return;
      resetData();
      info.container.file = file;
    };

    // 生成文件切片
    // create file chunk
    const createFileChunk = (file: any, size = 10 * 1024 * 1024) => {
      const fileChunkList = [];
      let cur = 0;
      while (cur < file.size) {
        /**
         * 为什么file可以使用slice方法？
         * 因为 file 是 File 对象，而 File 对象继承自 Blob 对象；Blob 对象有 slice 方法，可以用来切分数据。
         */
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
      console.log(info.container.hash + "1111111");

      const { shouldUpload, uploadedList } = await verifyUpload(
        info.container.file.name,
        info.container.hash
      );

      if (!shouldUpload) {
        ElMessage({
          message: "跳过上传：文件上传成功，查看/目标目录",
          type: "success",
        });
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
      ElMessage({
        message: "文件上传成功，查看/目标目录",
        type: "success",
      });
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

    // 暂停恢复
    const handleResume = async () => {
      info.status = "uploading";
      console.log(info.container.hash + "2222222");
      const { uploadedList } = await verifyUpload(
        info.container.file.name,
        info.container.hash
      );
      await uploadChunks(uploadedList);
    };

    // 暂停
    const handlePause = () => {
      info.status = "pause";
      resetData();
    };

    const handleDelete = async () => {
      const { data } = await request({
        url: "http://localhost:3003/delete",
      });
      if (JSON.parse(data).code === 0) {
        ElMessage({
          message: "删除成功",
          type: "success",
        });
      }
    };

    return {
      transformByte,
      handleFileChange,
      handleUpload,
      handleResume,
      handlePause,
      handleDelete,
      info,
    };
  },
});
</script>

<style lang="less" scoped></style>
