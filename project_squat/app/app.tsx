import React, {useState, useEffect} from 'react'
import { StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator, ScrollView, ListRenderItem} from 'react-native'
import { BleManager, Device, Characteristic, Service } from 'react-native-ble-plx'
import { LogBox } from 'react-native'
import * as ExpoDevice from 'expo-device'
import * as Permissions from 'expo-permissions'

LogBox.ignoreLogs(['new NativeEventEmitter'])

const bleManager = new BleManager()

//Define interface
interface DeviceCharacteristic extends Characteristic{

}


export default function App(){
    const [scanning, setScanning] = useState<boolean>(false)
    const [devices, setDevices] = useState<Device[]>([])
    const [connectedDevice, setConnectedDevice] = useState<Device | null>(null)
    const [deviceCharacteristics, setDeviceCharacteristics] = useState<DeviceCharacteristic[]>([])
    const [selectCharacteristic, setSelectCharacteristic] = useState<DeviceCharacteristic | null>(null)
    const [recievedData, setRecievedData] = useState<string>("")
    const [controlValue, setControlValue] = useState<number>(0)
}
