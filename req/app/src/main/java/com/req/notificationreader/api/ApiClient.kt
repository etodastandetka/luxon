package com.req.notificationreader.api

import com.req.notificationreader.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

class ApiClient(private val baseUrl: String) {
    
    private var authToken: String? = null
    
    fun setAuthToken(token: String?) {
        this.authToken = token
    }
    
    fun clearAuthToken() {
        this.authToken = null
    }
    
    suspend fun login(username: String, password: String): Result<LoginResponse> = withContext(Dispatchers.IO) {
        try {
            val url = URL("$baseUrl/api/auth/login")
            val connection = url.openConnection() as HttpURLConnection
            
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.doOutput = true
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            
            val json = JSONObject()
            json.put("username", username)
            json.put("password", password)
            
            connection.outputStream.use { it.write(json.toString().toByteArray()) }
            
            val responseCode = connection.responseCode
            val response = if (responseCode == HttpURLConnection.HTTP_OK) {
                connection.inputStream.bufferedReader().use { it.readText() }
            } else {
                connection.errorStream?.bufferedReader()?.use { it.readText() } ?: "{}"
            }
            
            connection.disconnect()
            
            if (responseCode == HttpURLConnection.HTTP_OK) {
                val jsonResponse = JSONObject(response)
                if (jsonResponse.getBoolean("success")) {
                    val data = jsonResponse.getJSONObject("data")
                    val userObj = data.getJSONObject("user")
                    val user = AdminUser(
                        id = userObj.getInt("id"),
                        username = userObj.getString("username"),
                        email = userObj.optString("email", null),
                        isActive = userObj.getBoolean("isActive"),
                        isSuperAdmin = userObj.getBoolean("isSuperAdmin")
                    )
                    
                    // Извлекаем токен из cookies (если есть)
                    val cookies = connection.getHeaderField("Set-Cookie")
                    val token = extractTokenFromCookies(cookies)
                    if (token != null) {
                        setAuthToken(token)
                    }
                    
                    Result.success(LoginResponse(user, data.optString("message", "Login successful")))
                } else {
                    Result.failure(Exception(jsonResponse.optString("error", "Login failed")))
                }
            } else {
                val jsonResponse = JSONObject(response)
                Result.failure(Exception(jsonResponse.optString("error", "Login failed")))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getRequests(
        type: String? = null,
        status: String? = null,
        page: Int = 1,
        limit: Int = 50
    ): Result<RequestsResponse> = withContext(Dispatchers.IO) {
        try {
            val queryParams = mutableListOf<String>()
            if (type != null) queryParams.add("type=$type")
            if (status != null) queryParams.add("status=$status")
            queryParams.add("page=$page")
            queryParams.add("limit=$limit")
            
            val url = URL("$baseUrl/api/requests?${queryParams.joinToString("&")}")
            val connection = url.openConnection() as HttpURLConnection
            
            connection.requestMethod = "GET"
            connection.setRequestProperty("Content-Type", "application/json")
            if (authToken != null) {
                connection.setRequestProperty("Cookie", "auth_token=$authToken")
            }
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            
            val responseCode = connection.responseCode
            val response = if (responseCode == HttpURLConnection.HTTP_OK) {
                connection.inputStream.bufferedReader().use { it.readText() }
            } else {
                connection.errorStream?.bufferedReader()?.use { it.readText() } ?: "{}"
            }
            
            connection.disconnect()
            
            if (responseCode == HttpURLConnection.HTTP_OK) {
                val jsonResponse = JSONObject(response)
                if (jsonResponse.getBoolean("success")) {
                    val data = jsonResponse.getJSONObject("data")
                    val requestsArray = data.getJSONArray("requests")
                    val requests = mutableListOf<Request>()
                    
                    for (i in 0 until requestsArray.length()) {
                        val reqObj = requestsArray.getJSONObject(i)
                        requests.add(parseRequest(reqObj))
                    }
                    
                    val pagination = if (data.has("pagination")) {
                        val pagObj = data.getJSONObject("pagination")
                        Pagination(
                            page = pagObj.getInt("page"),
                            limit = pagObj.getInt("limit"),
                            total = pagObj.getInt("total"),
                            totalPages = pagObj.getInt("totalPages")
                        )
                    } else null
                    
                    Result.success(RequestsResponse(requests, pagination))
                } else {
                    Result.failure(Exception(jsonResponse.optString("error", "Failed to fetch requests")))
                }
            } else {
                val jsonResponse = JSONObject(response)
                Result.failure(Exception(jsonResponse.optString("error", "Failed to fetch requests")))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    private fun parseRequest(reqObj: JSONObject): Request {
        return Request(
            id = reqObj.getInt("id"),
            userId = reqObj.getString("userId"),
            username = reqObj.optString("username", null),
            firstName = reqObj.optString("firstName", null),
            lastName = reqObj.optString("lastName", null),
            bookmaker = reqObj.optString("bookmaker", null),
            accountId = reqObj.optString("accountId", null),
            amount = reqObj.optString("amount", null),
            requestType = reqObj.getString("requestType"),
            status = reqObj.getString("status"),
            status_detail = reqObj.optString("status_detail", null),
            withdrawalCode = reqObj.optString("withdrawalCode", null),
            photoFileId = reqObj.optString("photoFileId", null),
            photoFileUrl = reqObj.optString("photoFileUrl", null),
            bank = reqObj.optString("bank", null),
            phone = reqObj.optString("phone", null),
            createdAt = reqObj.getString("createdAt"),
            updatedAt = reqObj.optString("updatedAt", null),
            processedAt = reqObj.optString("processedAt", null)
        )
    }
    
    suspend fun getWallets(): Result<List<com.req.notificationreader.model.Wallet>> = withContext(Dispatchers.IO) {
        try {
            val url = URL("$baseUrl/api/requisites")
            val connection = url.openConnection() as HttpURLConnection
            
            connection.requestMethod = "GET"
            connection.setRequestProperty("Content-Type", "application/json")
            if (authToken != null) {
                connection.setRequestProperty("Cookie", "auth_token=$authToken")
            }
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            
            val responseCode = connection.responseCode
            val response = if (responseCode == HttpURLConnection.HTTP_OK) {
                connection.inputStream.bufferedReader().use { it.readText() }
            } else {
                connection.errorStream?.bufferedReader()?.use { it.readText() } ?: "{}"
            }
            
            connection.disconnect()
            
            if (responseCode == HttpURLConnection.HTTP_OK) {
                val jsonResponse = JSONObject(response)
                if (jsonResponse.getBoolean("success")) {
                    val data = jsonResponse.getJSONArray("data")
                    val wallets = mutableListOf<com.req.notificationreader.model.Wallet>()
                    
                    for (i in 0 until data.length()) {
                        val walletObj = data.getJSONObject(i)
                        wallets.add(com.req.notificationreader.model.Wallet(
                            id = walletObj.getInt("id"),
                            name = walletObj.optString("name", null),
                            value = walletObj.getString("value"),
                            email = walletObj.optString("email", null),
                            password = walletObj.optString("password", null),
                            isActive = walletObj.getBoolean("isActive")
                        ))
                    }
                    
                    Result.success(wallets)
                } else {
                    Result.failure(Exception(jsonResponse.optString("error", "Failed to fetch wallets")))
                }
            } else {
                val jsonResponse = JSONObject(response)
                Result.failure(Exception(jsonResponse.optString("error", "Failed to fetch wallets")))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun createWallet(
        name: String?,
        value: String,
        email: String?,
        password: String?,
        isActive: Boolean
    ): Result<com.req.notificationreader.model.Wallet> = withContext(Dispatchers.IO) {
        try {
            val url = URL("$baseUrl/api/requisites")
            val connection = url.openConnection() as HttpURLConnection
            
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            if (authToken != null) {
                connection.setRequestProperty("Cookie", "auth_token=$authToken")
            }
            connection.doOutput = true
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            
            val json = JSONObject()
            if (name != null) json.put("name", name)
            json.put("value", value)
            if (email != null) json.put("email", email)
            if (password != null) json.put("password", password)
            json.put("isActive", isActive)
            
            connection.outputStream.use { it.write(json.toString().toByteArray()) }
            
            val responseCode = connection.responseCode
            val response = if (responseCode == HttpURLConnection.HTTP_OK || responseCode == HttpURLConnection.HTTP_CREATED) {
                connection.inputStream.bufferedReader().use { it.readText() }
            } else {
                connection.errorStream?.bufferedReader()?.use { it.readText() } ?: "{}"
            }
            
            connection.disconnect()
            
            if (responseCode == HttpURLConnection.HTTP_OK || responseCode == HttpURLConnection.HTTP_CREATED) {
                val jsonResponse = JSONObject(response)
                if (jsonResponse.getBoolean("success")) {
                    val walletObj = jsonResponse.getJSONObject("data")
                    val wallet = com.req.notificationreader.model.Wallet(
                        id = walletObj.getInt("id"),
                        name = walletObj.optString("name", null),
                        value = walletObj.getString("value"),
                        email = walletObj.optString("email", null),
                        password = walletObj.optString("password", null),
                        isActive = walletObj.getBoolean("isActive")
                    )
                    Result.success(wallet)
                } else {
                    Result.failure(Exception(jsonResponse.optString("error", "Failed to create wallet")))
                }
            } else {
                val jsonResponse = JSONObject(response)
                Result.failure(Exception(jsonResponse.optString("error", "Failed to create wallet")))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun updateWallet(
        id: Int,
        name: String? = null,
        value: String? = null,
        email: String? = null,
        password: String? = null,
        isActive: Boolean? = null
    ): Result<com.req.notificationreader.model.Wallet> = withContext(Dispatchers.IO) {
        try {
            val url = URL("$baseUrl/api/requisites/$id")
            val connection = url.openConnection() as HttpURLConnection
            
            connection.requestMethod = "PATCH"
            connection.setRequestProperty("Content-Type", "application/json")
            if (authToken != null) {
                connection.setRequestProperty("Cookie", "auth_token=$authToken")
            }
            connection.doOutput = true
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            
            val json = JSONObject()
            if (name != null) json.put("name", name)
            if (value != null) json.put("value", value)
            if (email != null) json.put("email", email)
            if (password != null && password.isNotEmpty()) json.put("password", password)
            if (isActive != null) json.put("isActive", isActive)
            
            connection.outputStream.use { it.write(json.toString().toByteArray()) }
            
            val responseCode = connection.responseCode
            val response = if (responseCode == HttpURLConnection.HTTP_OK) {
                connection.inputStream.bufferedReader().use { it.readText() }
            } else {
                connection.errorStream?.bufferedReader()?.use { it.readText() } ?: "{}"
            }
            
            connection.disconnect()
            
            if (responseCode == HttpURLConnection.HTTP_OK) {
                val jsonResponse = JSONObject(response)
                if (jsonResponse.getBoolean("success")) {
                    val walletObj = jsonResponse.getJSONObject("data")
                    val wallet = com.req.notificationreader.model.Wallet(
                        id = walletObj.getInt("id"),
                        name = walletObj.optString("name", null),
                        value = walletObj.getString("value"),
                        email = walletObj.optString("email", null),
                        password = walletObj.optString("password", null),
                        isActive = walletObj.getBoolean("isActive")
                    )
                    Result.success(wallet)
                } else {
                    Result.failure(Exception(jsonResponse.optString("error", "Failed to update wallet")))
                }
            } else {
                val jsonResponse = JSONObject(response)
                Result.failure(Exception(jsonResponse.optString("error", "Failed to update wallet")))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun deleteWallet(id: Int): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val url = URL("$baseUrl/api/requisites/$id")
            val connection = url.openConnection() as HttpURLConnection
            
            connection.requestMethod = "DELETE"
            if (authToken != null) {
                connection.setRequestProperty("Cookie", "auth_token=$authToken")
            }
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            
            val responseCode = connection.responseCode
            connection.disconnect()
            
            if (responseCode == HttpURLConnection.HTTP_OK || responseCode == HttpURLConnection.HTTP_NO_CONTENT) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to delete wallet"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getTransactionHistory(type: String? = null): Result<List<com.req.notificationreader.model.Transaction>> = withContext(Dispatchers.IO) {
        try {
            val queryParams = mutableListOf<String>()
            if (type != null) queryParams.add("type=$type")
            
            val url = URL("$baseUrl/api/transaction-history?${queryParams.joinToString("&")}")
            val connection = url.openConnection() as HttpURLConnection
            
            connection.requestMethod = "GET"
            connection.setRequestProperty("Content-Type", "application/json")
            if (authToken != null) {
                connection.setRequestProperty("Cookie", "auth_token=$authToken")
            }
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            
            val responseCode = connection.responseCode
            val response = if (responseCode == HttpURLConnection.HTTP_OK) {
                connection.inputStream.bufferedReader().use { it.readText() }
            } else {
                connection.errorStream?.bufferedReader()?.use { it.readText() } ?: "{}"
            }
            
            connection.disconnect()
            
            if (responseCode == HttpURLConnection.HTTP_OK) {
                val jsonResponse = JSONObject(response)
                if (jsonResponse.getBoolean("success")) {
                    val data = jsonResponse.getJSONObject("data")
                    val transactionsArray = data.getJSONArray("transactions")
                    val transactions = mutableListOf<com.req.notificationreader.model.Transaction>()
                    
                    for (i in 0 until transactionsArray.length()) {
                        val txObj = transactionsArray.getJSONObject(i)
                        transactions.add(com.req.notificationreader.model.Transaction(
                            id = txObj.getString("id"),
                            user_id = txObj.getString("user_id"),
                            account_id = txObj.getString("account_id"),
                            user_display_name = txObj.getString("user_display_name"),
                            type = txObj.getString("type"),
                            amount = txObj.getDouble("amount"),
                            status = txObj.getString("status"),
                            status_detail = txObj.optString("status_detail", null),
                            bookmaker = txObj.optString("bookmaker", null),
                            bank = txObj.optString("bank", null),
                            created_at = txObj.getString("created_at")
                        ))
                    }
                    
                    Result.success(transactions)
                } else {
                    Result.failure(Exception(jsonResponse.optString("error", "Failed to fetch transactions")))
                }
            } else {
                val jsonResponse = JSONObject(response)
                Result.failure(Exception(jsonResponse.optString("error", "Failed to fetch transactions")))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    private fun extractTokenFromCookies(cookies: String?): String? {
        if (cookies == null) return null
        val cookiePairs = cookies.split(";")
        for (pair in cookiePairs) {
            val trimmed = pair.trim()
            if (trimmed.startsWith("auth_token=")) {
                return trimmed.substringAfter("auth_token=").split(";")[0].trim()
            }
        }
        return null
    }
}
