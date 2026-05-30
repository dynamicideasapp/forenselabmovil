// MediaStoreSaver.java — plugin Capacitor que guarda imágenes/vídeos en la Galería vía MediaStore.
package com.forenselab.mobile;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;

@CapacitorPlugin(name = "MediaStoreSaver")
public class MediaStoreSaver extends Plugin {

    // saveMedia({ data: base64, name, mimeType, kind: "image"|"video", album }) → { uri, path }
    @PluginMethod
    public void saveMedia(PluginCall call) {
        String data = call.getString("data");
        String name = call.getString("name");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String kind = call.getString("kind", "image");
        String album = call.getString("album", "ForenseLab");

        if (data == null || name == null) {
            call.reject("Faltan datos (data/name)");
            return;
        }

        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            ContentResolver resolver = getContext().getContentResolver();

            boolean isVideo = "video".equals(kind);
            Uri collection;
            String relativeBase;
            if (isVideo) {
                collection = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                        : MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
                relativeBase = Environment.DIRECTORY_MOVIES;
            } else {
                collection = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                        : MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                relativeBase = Environment.DIRECTORY_PICTURES;
            }

            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
            // Android 10+ (scoped storage): RELATIVE_PATH + IS_PENDING, sin permisos legacy.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, relativeBase + "/" + album);
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            }

            Uri item = resolver.insert(collection, values);
            if (item == null) {
                call.reject("MediaStore no devolvió URI");
                return;
            }

            OutputStream os = resolver.openOutputStream(item);
            if (os == null) {
                call.reject("No se pudo abrir el flujo de salida");
                return;
            }
            try {
                os.write(bytes);
                os.flush();
            } finally {
                os.close();
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.clear();
                values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(item, values, null, null);
            }

            JSObject ret = new JSObject();
            ret.put("uri", item.toString());
            ret.put("path", relativeBase + "/" + album + "/" + name);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error al guardar en galería: " + e.getMessage(), e);
        }
    }
}
