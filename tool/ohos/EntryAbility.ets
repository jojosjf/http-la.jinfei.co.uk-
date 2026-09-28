// 鸿蒙版入口。复制到鸿蒙工程的
// ohos/entry/src/main/ets/entryability/EntryAbility.ets，覆盖原文件。
//
// 除了模板原有的插件注册，这里实现“保存结果图”：弹出系统的保存确认框，
// 用户确认后写入相册。这种方式不需要申请任何相册权限。
import { FlutterAbility, FlutterEngine } from '@ohos/flutter_ohos';
import MethodChannel, {
  MethodCallHandler,
  MethodResult
} from '@ohos/flutter_ohos/src/main/ets/plugin/common/MethodChannel';
import MethodCall from '@ohos/flutter_ohos/src/main/ets/plugin/common/MethodCall';
import { common } from '@kit.AbilityKit';
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { fileIo as fs, fileUri } from '@kit.CoreFileKit';
import { GeneratedPluginRegistrant } from '../plugins/GeneratedPluginRegistrant';

const CHANNEL = 'card_centering/image_saver';

class ImageSaverHandler implements MethodCallHandler {
  private context: common.UIAbilityContext;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  onMethodCall(call: MethodCall, result: MethodResult): void {
    if (call.method !== 'saveImage') {
      result.notImplemented();
      return;
    }
    const bytes = call.argument('bytes') as Uint8Array;
    const name = (call.argument('name') as string) ?? 'card_centering.png';
    this.save(bytes, name)
      .then((outcome: string) => result.success(outcome))
      .catch((e: Error) => result.error('failed', e.message, null));
  }

  private async save(bytes: Uint8Array, name: string): Promise<string> {
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    // 系统保存框需要一个应用内的源文件，先写到缓存目录，用完删除。
    const path = this.context.cacheDir + '/' + name;
    const tmp = fs.openSync(path, fs.OpenMode.CREATE | fs.OpenMode.READ_WRITE | fs.OpenMode.TRUNC);
    fs.writeSync(tmp.fd, data);
    fs.closeSync(tmp);
    try {
      const helper = photoAccessHelper.getPhotoAccessHelper(this.context);
      const configs: Array<photoAccessHelper.PhotoCreationConfig> = [
        {
          title: name.replace(new RegExp('\\.png$'), ''),
          fileNameExtension: 'png',
          photoType: photoAccessHelper.PhotoType.IMAGE,
          subtype: photoAccessHelper.PhotoSubtype.DEFAULT
        }
      ];
      const uris: Array<string> =
        await helper.showAssetsCreationDialog([fileUri.getUriFromPath(path)], configs);
      if (!uris || uris.length === 0) {
        return 'cancelled';
      }
      const dst = fs.openSync(uris[0], fs.OpenMode.WRITE_ONLY);
      fs.writeSync(dst.fd, data);
      fs.closeSync(dst);
      return 'saved';
    } finally {
      fs.unlinkSync(path);
    }
  }
}

export default class EntryAbility extends FlutterAbility {
  configureFlutterEngine(flutterEngine: FlutterEngine) {
    super.configureFlutterEngine(flutterEngine);
    GeneratedPluginRegistrant.registerWith(flutterEngine);
    const channel = new MethodChannel(flutterEngine.dartExecutor.getBinaryMessenger(), CHANNEL);
    channel.setMethodCallHandler(new ImageSaverHandler(this.context));
  }
}
