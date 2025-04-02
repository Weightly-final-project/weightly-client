import { PermissionResponse } from "expo-camera";
import { Button, Dimensions, StyleSheet, Text, View } from "react-native";

export default function Permission (props:{
    requestPermissions: () => Promise<PermissionResponse>;
    permissionType: string;
}) {
    const { requestPermissions, permissionType } = props;
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your {permissionType} permission</Text>
        <Button onPress={requestPermissions} title="grant permission" />
      </View>
    );
}

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
  },
  camera: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'center',
    width: windowWidth,
    height: windowHeight - 70,
  },
  image: {
    margin: 5,
    width: windowWidth,
    height: windowHeight / 2.7,
    alignSelf: 'center',
    objectFit: 'contain',
    backgroundColor: 'black',
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    justifyContent: 'space-around',
    marginTop: 64,
    marginBottom: 64,
    marginLeft: 0,
    marginRight: 0,
  },
  button: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  pointMarker: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'red'
  },
  tableHeader: {
    backgroundColor: '#DCDCDC',
  },
});